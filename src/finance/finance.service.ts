import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, CouponMaxScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateCouponInput {
    name: string;
    code: string;
    type: 'PERCENT' | 'AMOUNT';
    value: number;
    maxUses?: number | null;
    maxUsesScope?: CouponMaxScope;
    sourceName?: string | null;
    channel?: string | null;
    active?: boolean;
    startsAt?: string | Date | null;
    expiresAt?: string | Date | null;
    courseIds?: string[];
}

export interface UpdateCouponInput {
    name?: string;
    code?: string;
    type?: 'PERCENT' | 'AMOUNT';
    value?: number;
    maxUses?: number | null;
    maxUsesScope?: CouponMaxScope;
    sourceName?: string | null;
    channel?: string | null;
    active?: boolean;
    startsAt?: string | Date | null;
    expiresAt?: string | Date | null;
    courseIds?: string[];
}

interface RedeemCouponInput {
    // Prefer couponId; couponCode is a fallback for legacy payments that only
    // stored the free-text code.
    couponId?: string | null;
    couponCode?: string | null;
    studentId: string;
    courseId: string;
    paymentId?: string | null;
    amountOff?: number;
}

@Injectable()
export class FinanceService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
    ) { }

    async getPaymentReport() {
        const [totalPayments, revenueSum, statusCounts] = await Promise.all([
            this.prisma.payment.count(),
            this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }),
            this.prisma.payment.groupBy({ by: ['status'], _count: true }),
        ]);

        const statusMap: Record<string, number> = {};
        statusCounts.forEach((s: { status: string; _count: number }) => { statusMap[s.status] = s._count; });

        return {
            totalPayments,
            totalRevenue: Number(revenueSum._sum.amount || 0),
            statusCounts: statusMap,
        };
    }

    // ------------------------------------------------------------------
    // Coupons
    // ------------------------------------------------------------------

    private normalizeCode(code: string): string {
        return code.trim().toUpperCase();
    }

    private round2(n: number): number {
        return Math.round(n * 100) / 100;
    }

    /** Pure discount math shared by validate + checkout. */
    private computeDiscount(coupon: { type: 'PERCENT' | 'AMOUNT'; value: Prisma.Decimal }, price: number) {
        const value = Number(coupon.value);
        const amountOff = coupon.type === 'PERCENT' ? this.round2(price * (value / 100)) : this.round2(value);
        const finalAmount = Math.max(0, this.round2(price - amountOff));
        return { value, amountOff, finalAmount };
    }

    private assertDiscountValue(type: 'PERCENT' | 'AMOUNT', value: number) {
        if (!(value > 0)) throw new BadRequestException('Value must be positive');
        if (type === 'PERCENT' && value > 100) throw new BadRequestException('Percentage cannot exceed 100');
    }

    private assertWindowOpen(coupon: { startsAt: Date | null; expiresAt: Date | null; active: boolean }) {
        const now = new Date();
        if (!coupon.active) throw new BadRequestException('This coupon is inactive');
        if (coupon.startsAt && coupon.startsAt > now) throw new BadRequestException('This coupon is not valid yet');
        if (coupon.expiresAt && coupon.expiresAt < now) throw new BadRequestException('This coupon has expired');
    }

    private assertCourseScope(coupon: { courses: { courseId: string }[] }, courseId?: string) {
        if (courseId && coupon.courses.length > 0 && !coupon.courses.some((c) => c.courseId === courseId)) {
            throw new BadRequestException('This coupon does not apply to this course');
        }
    }

    private async resolveCourseIds(courseIds?: string[]): Promise<string[]> {
        if (!courseIds || courseIds.length === 0) return [];
        const unique = Array.from(new Set(courseIds.filter((c) => c && c.trim())));
        if (unique.length === 0) return [];
        const found = await this.prisma.course.count({ where: { id: { in: unique } } });
        if (found !== unique.length) throw new BadRequestException('One or more target courses were not found');
        return unique;
    }

    async getCoupons() {
        return this.prisma.coupon.findMany({
            include: {
                courses: { include: { course: { select: { id: true, titleAr: true, titleEn: true } } } },
                _count: { select: { redemptions: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getCouponStats(id: string) {
        const coupon = await this.prisma.coupon.findUnique({
            where: { id },
            include: {
                courses: { include: { course: { select: { id: true, titleAr: true, titleEn: true } } } },
            },
        });
        if (!coupon) throw new NotFoundException('Coupon not found');

        const redemptions = await this.prisma.couponRedemption.findMany({
            where: { couponId: id },
            include: {
                student: { select: { id: true, email: true } },
                course: { select: { id: true, titleAr: true, titleEn: true } },
            },
            orderBy: { usedAt: 'desc' },
        });

        const totalDiscount = redemptions.reduce((sum, r) => sum + Number(r.amountOff), 0);
        const perCourseMap = new Map<string, { courseId: string; titleAr: string; titleEn: string; count: number; discount: number }>();
        for (const r of redemptions) {
            const entry = perCourseMap.get(r.courseId) ?? {
                courseId: r.courseId,
                titleAr: r.course.titleAr,
                titleEn: r.course.titleEn,
                count: 0,
                discount: 0,
            };
            entry.count += 1;
            entry.discount += Number(r.amountOff);
            perCourseMap.set(r.courseId, entry);
        }

        return {
            coupon,
            totalRedemptions: redemptions.length,
            totalDiscount: this.round2(totalDiscount),
            perCourse: Array.from(perCourseMap.values()),
            redemptions,
        };
    }

    async createCoupon(dto: CreateCouponInput) {
        const name = dto.name?.trim();
        if (!name) throw new BadRequestException('Name is required');
        if (!dto.code || !dto.code.trim()) throw new BadRequestException('Code is required');
        this.assertDiscountValue(dto.type, dto.value);
        if (dto.maxUses != null && dto.maxUses < 1) throw new BadRequestException('maxUses must be at least 1');
        const maxUsesScope = dto.maxUsesScope ?? CouponMaxScope.TOTAL;

        const code = this.normalizeCode(dto.code);
        const existing = await this.prisma.coupon.findUnique({ where: { code } });
        if (existing) throw new BadRequestException('Coupon code already exists');

        const courseIds = await this.resolveCourseIds(dto.courseIds);

        const coupon = await this.prisma.coupon.create({
            data: {
                name,
                code,
                type: dto.type,
                value: dto.value,
                maxUses: dto.maxUses ?? null,
                maxUsesScope,
                active: dto.active ?? true,
                sourceName: dto.sourceName?.trim() || null,
                channel: dto.channel?.trim() || null,
                startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
                courses: courseIds.length ? { create: courseIds.map((courseId) => ({ courseId })) } : undefined,
            },
            include: { courses: { include: { course: { select: { id: true, titleAr: true, titleEn: true } } } } },
        });

        await this.audit.logAction('Created coupon ' + coupon.code, undefined, undefined);
        return coupon;
    }

    async updateCoupon(id: string, dto: UpdateCouponInput) {
        const existing = await this.prisma.coupon.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Coupon not found');

        const data: Prisma.CouponUpdateInput = {};

        if (dto.name !== undefined) {
            const name = dto.name.trim();
            if (!name) throw new BadRequestException('Name cannot be empty');
            data.name = name;
        }
        if (dto.code !== undefined) {
            const code = this.normalizeCode(dto.code);
            if (!code) throw new BadRequestException('Code cannot be empty');
            if (code !== existing.code) {
                const clash = await this.prisma.coupon.findUnique({ where: { code } });
                if (clash) throw new BadRequestException('Coupon code already exists');
            }
            data.code = code;
        }
        const effectiveType = dto.type ?? (existing.type as 'PERCENT' | 'AMOUNT');
        if (dto.value !== undefined) this.assertDiscountValue(effectiveType, dto.value);
        if (dto.type !== undefined) data.type = dto.type;
        if (dto.value !== undefined) data.value = dto.value;
        if (dto.maxUses !== undefined) {
            if (dto.maxUses != null && dto.maxUses < 1) throw new BadRequestException('maxUses must be at least 1');
            data.maxUses = dto.maxUses;
        }
        if (dto.maxUsesScope !== undefined) data.maxUsesScope = dto.maxUsesScope;
        if (dto.active !== undefined) data.active = dto.active;
        if (dto.sourceName !== undefined) data.sourceName = dto.sourceName?.trim() || null;
        if (dto.channel !== undefined) data.channel = dto.channel?.trim() || null;
        if (dto.startsAt !== undefined) data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
        if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

        if (dto.courseIds !== undefined) {
            const courseIds = await this.resolveCourseIds(dto.courseIds);
            await this.prisma.couponCourse.deleteMany({ where: { couponId: id } });
            if (courseIds.length) data.courses = { create: courseIds.map((courseId) => ({ courseId })) };
        }

        const coupon = await this.prisma.coupon.update({
            where: { id },
            data,
            include: { courses: { include: { course: { select: { id: true, titleAr: true, titleEn: true } } } } },
        });
        await this.audit.logAction('Updated coupon ' + coupon.code, undefined, undefined);
        return coupon;
    }

    async deleteCoupon(id: string) {
        const coupon = await this.prisma.coupon.findUnique({ where: { id } });
        if (!coupon) throw new NotFoundException('Coupon not found');

        // A coupon that was actually used is part of the finance ledger: deleting
        // it would erase the attribution/statistics and orphan redemptions.
        // Deactivate instead so history stays intact.
        const redemptions = await this.prisma.couponRedemption.count({ where: { couponId: id } });
        if (redemptions > 0) {
            throw new ConflictException('This coupon has redemptions and cannot be deleted; deactivate it instead');
        }

        await this.prisma.coupon.delete({ where: { id } });
        await this.audit.logAction('Deleted coupon ' + coupon.code, undefined, undefined);
        return { ok: true };
    }

    async validateCoupon(code: string, courseId?: string, price?: number) {
        if (!code || !code.trim()) throw new BadRequestException('Coupon code is required');
        const coupon = await this.prisma.coupon.findUnique({
            where: { code: this.normalizeCode(code) },
            include: { courses: { select: { courseId: true } } },
        });
        if (!coupon) throw new NotFoundException('Invalid coupon code');
        this.assertWindowOpen(coupon);
        this.assertCourseScope(coupon, courseId);

        if (coupon.maxUses !== null) {
            if (coupon.maxUsesScope === CouponMaxScope.TOTAL) {
                if (coupon.usedCount >= coupon.maxUses) throw new BadRequestException('This coupon has reached its usage limit');
            } else if (courseId) {
                const usedForCourse = await this.prisma.couponRedemption.count({ where: { couponId: coupon.id, courseId } });
                if (usedForCourse >= coupon.maxUses) throw new BadRequestException('This coupon has reached its usage limit for this course');
            }
        }

        const discount = price != null ? this.computeDiscount(coupon, price) : null;
        return {
            valid: true,
            id: coupon.id,
            name: coupon.name,
            code: coupon.code,
            type: coupon.type,
            value: Number(coupon.value),
            amountOff: discount?.amountOff ?? null,
            finalAmount: discount?.finalAmount ?? null,
        };
    }

    /**
     * Atomically record one coupon use and advance the usage counter. MUST run
     * inside a caller-owned transaction so the redemption, the payment status
     * and the enrollment decision commit or roll back together.
     *
     * Concurrency: a `SELECT ... FOR UPDATE` on the coupon row serialises all
     * redemptions for the same coupon, so the read-then-increment for TOTAL and
     * the per-course count for PER_COURSE can never race past the cap. The
     * unique (couponId, studentId, courseId) index independently blocks a
     * student reusing a coupon for the same course.
     */
    async redeemCoupon(tx: Prisma.TransactionClient, opts: RedeemCouponInput) {
        if (!opts.couponId && !opts.couponCode) throw new BadRequestException('Coupon reference is required');
        const coupon = opts.couponId
            ? await tx.coupon.findUnique({
                where: { id: opts.couponId },
                include: { courses: { select: { courseId: true } } },
            })
            : await tx.coupon.findUnique({
                where: { code: this.normalizeCode(opts.couponCode as string) },
                include: { courses: { select: { courseId: true } } },
            });
        if (!coupon) throw new NotFoundException('Coupon not found');
        this.assertWindowOpen(coupon);
        this.assertCourseScope(coupon, opts.courseId);

        // Serialise concurrent redemptions of this coupon.
        await tx.$queryRaw`SELECT "id" FROM "Coupon" WHERE "id" = ${coupon.id} FOR UPDATE`;

        if (coupon.maxUses !== null) {
            if (coupon.maxUsesScope === CouponMaxScope.TOTAL) {
                const res = await tx.coupon.updateMany({
                    where: { id: coupon.id, usedCount: { lt: coupon.maxUses } },
                    data: { usedCount: { increment: 1 } },
                });
                if (res.count !== 1) throw new ConflictException('This coupon has reached its usage limit');
            } else {
                const usedForCourse = await tx.couponRedemption.count({
                    where: { couponId: coupon.id, courseId: opts.courseId },
                });
                if (usedForCourse >= coupon.maxUses) {
                    throw new ConflictException('This coupon has reached its usage limit for this course');
                }
                await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
            }
        } else {
            await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
        }

        try {
            return await tx.couponRedemption.create({
                data: {
                    couponId: coupon.id,
                    studentId: opts.studentId,
                    courseId: opts.courseId,
                    paymentId: opts.paymentId ?? null,
                    amountOff: opts.amountOff ?? 0,
                },
            });
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new ConflictException('This student has already used this coupon for this course');
            }
            throw err;
        }
    }
}
