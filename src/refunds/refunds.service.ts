import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { RefundStatus, Role, PaymentStatus, EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../commerce/payments.service';
import { getFrontendUrl } from '../common/frontend-url';
import { CreateRefundRequestDto, ReviewRefundRequestDto } from './dto/refund.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

const REFUND_INCLUDE = {
    course: { select: { id: true, titleAr: true, titleEn: true } },
    opening: { select: { id: true, nameAr: true, nameEn: true, startDate: true, refundWindowDays: true } },
    student: { select: { id: true, email: true } },
    payment: {
        select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            receiptFileUrl: true,
            enrollmentId: true,
            createdAt: true,
        },
    },
    reviewedBy: { select: { id: true, email: true } },
} as const;

@Injectable()
export class RefundsService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private notifications: NotificationsService,
        private payments: PaymentsService,
    ) { }

    /** `startDate + refundWindowDays`; null when the opening has no window. */
    private deadlineOf(startDate: Date | null, days: number | null): Date | null {
        if (!startDate || days == null) return null;
        return new Date(startDate.getTime() + days * DAY_MS);
    }

    /**
     * Paid courses the signed-in student can request a refund for, plus the
     * ones they already did (or that closed). Computed from PAID payments so it
     * always reflects money that actually landed.
     */
    async getMyEligibility(studentId: string) {
        const [payments, requests] = await Promise.all([
            this.prisma.payment.findMany({
                where: { studentId, status: PaymentStatus.PAID },
                orderBy: { createdAt: 'desc' },
                include: {
                    opening: {
                        select: {
                            id: true,
                            nameAr: true,
                            nameEn: true,
                            startDate: true,
                            refundWindowDays: true,
                            courseId: true,
                            course: { select: { id: true, titleAr: true, titleEn: true } },
                        },
                    },
                },
            }),
            this.prisma.refundRequest.findMany({
                where: { studentId },
                select: { id: true, courseId: true, paymentId: true, status: true },
            }),
        ]);

        const byPayment = new Map(requests.filter((r) => r.paymentId).map((r) => [r.paymentId as string, r]));

        const now = Date.now();
        return payments.map((p) => {
            const opening = p.opening;
            const deadline = this.deadlineOf(opening?.startDate ?? null, opening?.refundWindowDays ?? null);
            const existing = byPayment.get(p.id) ?? null;
            let reason: string | null = null;
            if (existing) reason = 'already_requested';
            else if (!deadline) reason = 'no_window';
            else if (now > deadline.getTime()) reason = 'window_closed';

            return {
                paymentId: p.id,
                courseId: opening?.courseId ?? null,
                course: opening?.course ?? null,
                openingId: opening?.id ?? null,
                openingNameAr: opening?.nameAr ?? null,
                openingNameEn: opening?.nameEn ?? null,
                amount: Number(p.amount),
                currency: p.currency,
                receiptFileUrl: p.receiptFileUrl ?? null,
                enrollmentId: p.enrollmentId ?? null,
                paidAt: p.createdAt,
                startDate: opening?.startDate ?? null,
                refundWindowDays: opening?.refundWindowDays ?? null,
                deadline,
                eligible: !existing && !!deadline && now <= deadline.getTime(),
                reason,
                requestId: existing?.id ?? null,
                requestStatus: existing?.status ?? null,
            };
        });
    }

    async listMine(studentId: string) {
        return this.prisma.refundRequest.findMany({
            where: { studentId },
            include: REFUND_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
    }

    async listAll(status?: string) {
        const valid = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status);
        return this.prisma.refundRequest.findMany({
            where: valid ? { status: status as RefundStatus } : undefined,
            include: REFUND_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
    }

    async create(studentId: string, dto: CreateRefundRequestDto) {
        const enrollment = await this.prisma.enrollment.findUnique({
            where: { studentId_courseId: { studentId, courseId: dto.courseId } },
        });
        if (!enrollment || enrollment.status !== EnrollmentStatus.APPROVED) {
            throw new BadRequestException('You can only request a refund for an approved (paid) enrollment');
        }

        const payment = await this.prisma.payment.findFirst({
            where: {
                studentId,
                status: PaymentStatus.PAID,
                opening: { courseId: dto.courseId },
            },
            orderBy: { createdAt: 'desc' },
            include: { opening: true },
        });
        if (!payment) throw new BadRequestException('No paid payment found for this course');

        const opening = payment.opening;
        const deadline = this.deadlineOf(opening?.startDate ?? null, opening?.refundWindowDays ?? null);
        if (!deadline) throw new BadRequestException('Refunds are not available for this course');
        if (Date.now() > deadline.getTime()) {
            throw new BadRequestException('The refund window for this course has closed');
        }

        const existing = await this.prisma.refundRequest.findFirst({
            where: {
                studentId,
                courseId: dto.courseId,
                status: { in: [RefundStatus.PENDING, RefundStatus.APPROVED] },
            },
        });
        if (existing) throw new ConflictException('A refund request already exists for this course');

        const created = await this.prisma.refundRequest.create({
            data: {
                studentId,
                courseId: dto.courseId,
                openingId: payment.openingId,
                paymentId: payment.id,
                amount: payment.amount,
                currency: payment.currency,
                method: dto.method,
                accountName: dto.accountName.trim(),
                accountNumber: dto.accountNumber.trim(),
                studentNote: dto.studentNote?.trim() || null,
            },
        });

        const student = await this.prisma.user.findUnique({
            where: { id: studentId },
            select: { email: true },
        });

        // Alert the people who handle money and the batch: the instructor who
        // teaches this opening plus every finance/course-manager account.
        const staff = await this.prisma.user.findMany({
            where: { role: { in: [Role.FINANCE, Role.COURSE_MANAGER] }, isActive: true },
            select: { id: true, email: true, role: true },
        });
        const recipients = new Map<string, { id: string; email: string; role: Role }>();
        recipients.set(opening.instructorId, { id: opening.instructorId, email: '', role: Role.INSTRUCTOR });
        for (const s of staff) recipients.set(s.id, s);

        const studentEmail = student?.email ?? 'Student';
        const amountLabel = `${Number(payment.amount)} ${payment.currency}`;
        const frontend = getFrontendUrl();

        await Promise.all(
            Array.from(recipients.values()).map((r) =>
                this.notifications
                    .notify({
                        userId: r.id,
                        type: 'refund.requested',
                        titleAr: 'طلب استرداد جديد',
                        titleEn: 'New refund request',
                        bodyAr: `قدّم ${studentEmail} طلب استرداد بمبلغ ${amountLabel}.`,
                        bodyEn: `${studentEmail} requested a refund of ${amountLabel}.`,
                        data: {
                            refundRequestId: created.id,
                            courseId: dto.courseId,
                            openingId: payment.openingId,
                            paymentId: payment.id,
                        },
                        email:
                            r.role === Role.FINANCE || r.role === Role.ADMIN
                                ? { to: r.email, actionUrl: `${frontend}/dashboard/admin/finance` }
                                : undefined,
                    })
                    .catch(() => undefined),
            ),
        );

        await this.audit.logAction(
            `Refund request ${created.id} created for course ${dto.courseId} (${amountLabel})`,
            undefined,
            studentId,
        );

        return created;
    }

    async review(id: string, actorId: string, role: Role, dto: ReviewRefundRequestDto) {
        const request = await this.prisma.refundRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException('Refund request not found');
        if (request.status !== RefundStatus.PENDING) {
            throw new ConflictException('This request has already been reviewed');
        }

        const note = dto.reviewerNote?.trim() || null;

        if (dto.status === 'REJECTED') {
            const updated = await this.prisma.refundRequest.update({
                where: { id },
                data: {
                    status: RefundStatus.REJECTED,
                    reviewerNote: note,
                    reviewedAt: new Date(),
                    reviewedById: actorId,
                },
            });
            await this.audit.logAction(`Refund request ${id} rejected`, undefined, actorId);
            await this.notifications
                .notify({
                    userId: request.studentId,
                    type: 'refund.rejected',
                    titleAr: 'تم رفض طلب الاسترداد',
                    titleEn: 'Refund request rejected',
                    bodyAr: note ?? 'تم رفض طلب استرداد المبلغ.',
                    bodyEn: note ?? 'Your refund request was rejected.',
                    data: { refundRequestId: id, courseId: request.courseId },
                })
                .catch(() => undefined);
            return updated;
        }

        if (!request.paymentId) {
            throw new BadRequestException('This request has no linked payment to refund');
        }

        // Runs the real refund: marks the payment REFUNDED, revokes the
        // enrollment, frees the seat and notifies the student. It also guards
        // against refunding a payment that is no longer PAID.
        await this.payments.refund(request.paymentId, actorId, role, note ?? undefined);

        const updated = await this.prisma.refundRequest.update({
            where: { id },
            data: {
                status: RefundStatus.APPROVED,
                reviewerNote: note,
                reviewedAt: new Date(),
                reviewedById: actorId,
            },
        });
        await this.audit.logAction(
            `Refund request ${id} approved (payment ${request.paymentId})`,
            undefined,
            actorId,
        );
        return updated;
    }
}
