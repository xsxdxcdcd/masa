import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@prisma/client';

@Injectable()
export class LearningPathsService {
    constructor(private prisma: PrismaService, private audit: AuditService) {}

    async createPath(dto: { titleAr: string; titleEn: string; descriptionAr?: string; descriptionEn?: string; coverImageUrl?: string; courseIds: string[] }, creatorId: string) {
        if (!dto.titleAr?.trim() || !dto.titleEn?.trim()) throw new BadRequestException('Titles required');
        const path = await this.prisma.learningPath.create({
            data: {
                titleAr: dto.titleAr.trim(),
                titleEn: dto.titleEn.trim(),
                descriptionAr: dto.descriptionAr || null,
                descriptionEn: dto.descriptionEn || null,
                coverImageUrl: dto.coverImageUrl || null,
                creatorId,
                courses: {
                    create: (dto.courseIds || []).map((courseId, i) => ({ courseId, orderIndex: i })),
                },
            },
            include: { courses: { include: { course: true }, orderBy: { orderIndex: 'asc' } } },
        });
        await this.audit.logAction(`Created learning path "${dto.titleAr}"`, undefined, creatorId);
        return path;
    }

    async listPaths(isPublished?: boolean) {
        return this.prisma.learningPath.findMany({
            where: isPublished !== undefined ? { isPublished } : {},
            include: { courses: { include: { course: true }, orderBy: { orderIndex: 'asc' } }, creator: { select: { id: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getPath(pathId: string) {
        const path = await this.prisma.learningPath.findUnique({
            where: { id: pathId },
            include: { courses: { include: { course: true }, orderBy: { orderIndex: 'asc' } }, creator: { select: { id: true, email: true } } },
        });
        if (!path) throw new NotFoundException('Learning path not found');
        return path;
    }

    async updatePath(pathId: string, dto: any, userId: string, userRole: Role) {
        const path = await this.prisma.learningPath.findUnique({ where: { id: pathId } });
        if (!path) throw new NotFoundException('Learning path not found');
        if (userRole !== Role.ADMIN && userRole !== Role.COURSE_MANAGER && path.creatorId !== userId) throw new ForbiddenException('Not allowed');
        if (dto.courseIds) {
            await this.prisma.learningPathCourse.deleteMany({ where: { pathId } });
            await this.prisma.learningPath.update({
                where: { id: pathId },
                data: {
                    titleAr: dto.titleAr ?? path.titleAr,
                    titleEn: dto.titleEn ?? path.titleEn,
                    descriptionAr: dto.descriptionAr !== undefined ? dto.descriptionAr : path.descriptionAr,
                    descriptionEn: dto.descriptionEn !== undefined ? dto.descriptionEn : path.descriptionEn,
                    coverImageUrl: dto.coverImageUrl !== undefined ? dto.coverImageUrl : path.coverImageUrl,
                    isPublished: dto.isPublished !== undefined ? dto.isPublished : path.isPublished,
                    courses: { create: dto.courseIds.map((courseId: string, i: number) => ({ courseId, orderIndex: i })) },
                },
            });
        } else {
            await this.prisma.learningPath.update({
                where: { id: pathId },
                data: {
                    titleAr: dto.titleAr ?? path.titleAr,
                    titleEn: dto.titleEn ?? path.titleEn,
                    descriptionAr: dto.descriptionAr !== undefined ? dto.descriptionAr : path.descriptionAr,
                    descriptionEn: dto.descriptionEn !== undefined ? dto.descriptionEn : path.descriptionEn,
                    coverImageUrl: dto.coverImageUrl !== undefined ? dto.coverImageUrl : path.coverImageUrl,
                    isPublished: dto.isPublished !== undefined ? dto.isPublished : path.isPublished,
                },
            });
        }
        return this.getPath(pathId);
    }

    async deletePath(pathId: string, userId: string, userRole: Role) {
        const path = await this.prisma.learningPath.findUnique({ where: { id: pathId } });
        if (!path) throw new NotFoundException('Learning path not found');
        if (userRole !== Role.ADMIN && userRole !== Role.COURSE_MANAGER && path.creatorId !== userId) throw new ForbiddenException('Not allowed');
        await this.prisma.learningPath.delete({ where: { id: pathId } });
        return { ok: true };
    }

    async enrollPath(pathId: string, userId: string) {
        const path = await this.getPath(pathId);
        const enrolled = [];
        for (const c of path.courses) {
            const openings = await this.prisma.courseOpening.findMany({ where: { courseId: c.course.id, isPublished: true } });
            const firstOpening = openings[0];
            if (firstOpening) {
                const existing = await this.prisma.enrollment.findFirst({ where: { studentId: userId, openingId: firstOpening.id } });
                if (!existing) {
                    await this.prisma.enrollment.create({
                        data: { studentId: userId, openingId: firstOpening.id, courseId: c.course.id, status: 'PENDING' },
                    });
                    enrolled.push(c.course.id);
                }
            }
        }
        return { enrolled, total: path.courses.length };
    }
}
