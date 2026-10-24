import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CoursesService } from '../courses/courses.service';
import { Role, CourseContentType, CourseOpeningStatus, ApplicationStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InstructorRequestsService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private coursesService: CoursesService,
        private notifications: NotificationsService,
    ) { }

    // ===================== OPENING REQUESTS =====================

    async getMyOpeningRequests(userId: string) {
        return this.prisma.openingRequest.findMany({
            where: { instructorId: userId },
            include: {
                course: { select: { id: true, titleAr: true, titleEn: true } },
                instructor: { select: { id: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getAllOpeningRequests() {
        return this.prisma.openingRequest.findMany({
            include: {
                course: { select: { id: true, titleAr: true, titleEn: true } },
                instructor: { select: { id: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createOpeningRequest(userId: string, dto: { courseId: string; reason?: string }) {
        if (!dto.courseId) throw new BadRequestException('courseId is required');
        const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
        if (!course) throw new NotFoundException('Course not found');

        const request = await this.prisma.openingRequest.create({
            data: {
                courseId: dto.courseId,
                instructorId: userId,
                reason: dto.reason?.trim() ? dto.reason.trim() : null,
            },
        });
        await this.audit.logAction(`Instructor ${userId} requested to open Course ${dto.courseId}`, undefined, userId);
        return request;
    }

    async reviewOpeningRequest(id: string, status: ApplicationStatus, reviewerId: string) {
        const existing = await this.prisma.openingRequest.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Opening request not found');
        const updated = await this.prisma.openingRequest.update({
            where: { id },
            data: { status, reviewedBy: reviewerId, reviewedAt: new Date() },
        });
        await this.audit.logAction(
            `Opening request ${id} -> ${status} (reviewer ${reviewerId})`,
            undefined,
            reviewerId,
        );
        await this.notifications.notify({
            userId: existing.instructorId,
            type: 'request.reviewed',
            titleAr: status === ApplicationStatus.APPROVED ? 'تمت الموافقة على طلبك' : 'تم رفض طلبك',
            titleEn: status === ApplicationStatus.APPROVED ? 'Request approved' : 'Request rejected',
            bodyAr: status === ApplicationStatus.APPROVED ? 'تمت الموافقة على طلب فتح دفعة جديدة.' : 'عذراً، تم رفض طلب فتح دفعة جديدة.',
            bodyEn: status === ApplicationStatus.APPROVED ? 'Your request to open a new batch was approved.' : 'Sorry, your request to open a new batch was rejected.',
            data: { type: 'opening', requestId: id },
        }).catch(() => {});
        return updated;
    }

    deleteOpeningRequest(id: string) {
        return this.prisma.openingRequest.delete({ where: { id } });
    }

    // ===================== CLOSE REQUESTS =====================

    async getMyCloseRequests(userId: string) {
        return this.prisma.closeRequest.findMany({
            where: { instructorId: userId },
            include: {
                opening: {
                    select: {
                        id: true,
                        nameAr: true,
                        nameEn: true,
                        status: true,
                        course: { select: { id: true, titleAr: true, titleEn: true } },
                    },
                },
                instructor: { select: { id: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getAllCloseRequests() {
        return this.prisma.closeRequest.findMany({
            include: {
                opening: {
                    select: {
                        id: true,
                        nameAr: true,
                        nameEn: true,
                        status: true,
                        course: { select: { id: true, titleAr: true, titleEn: true } },
                    },
                },
                instructor: { select: { id: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createCloseRequest(userId: string, dto: { openingId: string; reason?: string }) {
        if (!dto.openingId) throw new BadRequestException('openingId is required');
        const opening = await this.prisma.courseOpening.findUnique({ where: { id: dto.openingId } });
        if (!opening) throw new NotFoundException('Opening not found');
        // Only the assigned instructor can request to close their own opening.
        if (opening.instructorId !== userId) {
            throw new ForbiddenException('You are not the instructor of this opening');
        }
        if (opening.status === CourseOpeningStatus.ENDED) {
            throw new BadRequestException('This opening is already ended');
        }

        const pending = await this.prisma.closeRequest.count({
            where: { openingId: dto.openingId, status: ApplicationStatus.PENDING },
        });
        if (pending > 0) throw new BadRequestException('A close request for this opening is already pending');

        const request = await this.prisma.closeRequest.create({
            data: {
                openingId: dto.openingId,
                instructorId: userId,
                reason: dto.reason?.trim() ? dto.reason.trim() : null,
            },
        });
        await this.audit.logAction(`Instructor ${userId} requested to close Opening ${dto.openingId}`, undefined, userId);
        return request;
    }

    async reviewCloseRequest(id: string, status: ApplicationStatus, reviewerId: string) {
        const existing = await this.prisma.closeRequest.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Close request not found');

        const updated = await this.prisma.closeRequest.update({
            where: { id },
            data: { status, reviewedBy: reviewerId, reviewedAt: new Date() },
        });

        if (status === ApplicationStatus.APPROVED) {
            const opening = await this.prisma.courseOpening.findUnique({ where: { id: existing.openingId } });
            if (!opening) throw new NotFoundException('Opening not found');
            if (opening.status === CourseOpeningStatus.ENDED) {
                throw new BadRequestException('This opening is already ended');
            }
            await this.coursesService.endCourse(existing.openingId, reviewerId, Role.ADMIN);
        }

        await this.audit.logAction(
            `Close request ${id} -> ${status} (reviewer ${reviewerId})`,
            undefined,
            reviewerId,
        );
        await this.notifications.notify({
            userId: existing.instructorId,
            type: 'request.reviewed',
            titleAr: status === ApplicationStatus.APPROVED ? 'تمت الموافقة على طلب الإنهاء' : 'تم رفض طلب الإنهاء',
            titleEn: status === ApplicationStatus.APPROVED ? 'Close request approved' : 'Close request rejected',
            bodyAr: status === ApplicationStatus.APPROVED ? 'تمت الموافقة على إنهاء الدفعة وإصدار الشهادات.' : 'عذراً، لم تتم الموافقة على طلب إنهاء الدفعة.',
            bodyEn: status === ApplicationStatus.APPROVED ? 'Your close request was approved; certificates are being issued.' : 'Sorry, your close request was rejected.',
            data: { type: 'closure', requestId: id },
        }).catch(() => {});
        return updated;
    }

    deleteCloseRequest(id: string) {
        return this.prisma.closeRequest.delete({ where: { id } });
    }

    // ===================== COURSE SUGGESTIONS =====================

    async getMySuggestions(userId: string) {
        return this.prisma.courseSuggestion.findMany({
            where: { instructorId: userId },
            include: { instructor: { select: { id: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getAllSuggestions() {
        return this.prisma.courseSuggestion.findMany({
            include: { instructor: { select: { id: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createSuggestion(userId: string, dto: {
        titleAr: string;
        titleEn: string;
        categoryAr?: string;
        categoryEn?: string;
        description?: string;
    }) {
        if (!dto.titleAr?.trim() || !dto.titleEn?.trim()) {
            throw new BadRequestException('titleAr and titleEn are required');
        }
        const suggestion = await this.prisma.courseSuggestion.create({
            data: {
                titleAr: dto.titleAr.trim(),
                titleEn: dto.titleEn.trim(),
                categoryAr: dto.categoryAr?.trim() ? dto.categoryAr.trim() : null,
                categoryEn: dto.categoryEn?.trim() ? dto.categoryEn.trim() : null,
                description: dto.description?.trim() ? dto.description.trim() : null,
                instructorId: userId,
            },
        });
        await this.audit.logAction(`Instructor ${userId} suggested new course "${dto.titleAr}"`, undefined, userId);
        return suggestion;
    }

    async reviewSuggestion(id: string, status: ApplicationStatus, reviewerId: string, reviewNotes?: string) {
        const existing = await this.prisma.courseSuggestion.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Course suggestion not found');

        if (status === ApplicationStatus.APPROVED) {
            const course = await this.coursesService.create(
                {
                    titleAr: existing.titleAr,
                    titleEn: existing.titleEn,
                    categoryAr: existing.categoryAr ?? undefined,
                    categoryEn: existing.categoryEn ?? undefined,
                    excerptAr: existing.description ?? undefined,
                    excerptEn: existing.description ?? undefined,
                    // A suggestion carries no lessons yet, so the draft starts as
                    // live -- the academy's default -- and the instructor sets the
                    // real type when they fill the course in.
                    contentType: CourseContentType.LIVE,
                },
                existing.instructorId,
            );
            await this.audit.logAction(
                `Course "${existing.titleAr}" created from suggestion ${id} (reviewer ${reviewerId})`,
                undefined,
                reviewerId,
            );
        }

        const updated = await this.prisma.courseSuggestion.update({
            where: { id },
            data: {
                status,
                reviewNotes: reviewNotes?.trim() ? reviewNotes.trim() : null,
                reviewedBy: reviewerId,
                reviewedAt: new Date(),
            },
        });
        await this.audit.logAction(
            `Suggestion ${id} -> ${status} (reviewer ${reviewerId})`,
            undefined,
            reviewerId,
        );
        await this.notifications.notify({
            userId: existing.instructorId,
            type: 'request.reviewed',
            titleAr: status === ApplicationStatus.APPROVED ? 'تمت الموافقة على اقتراحك' : 'تم رفض اقتراحك',
            titleEn: status === ApplicationStatus.APPROVED ? 'Suggestion approved' : 'Suggestion rejected',
            bodyAr: status === ApplicationStatus.APPROVED ? 'تمت الموافقة على اقتراحك وتم إنشاء الدورة.' : 'عذراً، لم تتم الموافقة على اقتراحك.',
            bodyEn: status === ApplicationStatus.APPROVED ? 'Your course suggestion was approved and the course was created.' : 'Sorry, your course suggestion was rejected.',
            data: { type: 'suggestion', requestId: id },
        }).catch(() => {});
        return updated;
    }

    deleteSuggestion(id: string) {
        return this.prisma.courseSuggestion.delete({ where: { id } });
    }
}