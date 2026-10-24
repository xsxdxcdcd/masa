import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RatingsService {
    constructor(private prisma: PrismaService, private audit: AuditService) {}

    async rateInstructor(courseId: string, dto: { rating: number; commentAr?: string; commentEn?: string }, userId: string) {
        if (!dto.rating || dto.rating < 1 || dto.rating > 5) throw new BadRequestException('Rating must be 1-5');
        const course = await this.prisma.course.findUnique({ where: { id: courseId } });
        if (!course) throw new NotFoundException('Course not found');
        const rating = await this.prisma.instructorRating.upsert({
            where: { courseId_userId: { courseId, userId } },
            update: { rating: dto.rating, commentAr: dto.commentAr || null, commentEn: dto.commentEn || null },
            create: {
                courseId,
                instructorId: course.instructorId,
                userId,
                rating: dto.rating,
                commentAr: dto.commentAr || null,
                commentEn: dto.commentEn || null,
            },
        });
        await this.audit.logAction(`Rated instructor for course ${courseId}: ${dto.rating} stars`, undefined, userId);
        return rating;
    }

    async getInstructorRatings(instructorId: string) {
        const ratings = await this.prisma.instructorRating.findMany({
            where: { instructorId },
            include: { user: { select: { id: true, email: true } }, course: { select: { id: true, titleAr: true, titleEn: true } } },
            orderBy: { createdAt: 'desc' },
        });
        const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
        return { ratings, average: Math.round(avg * 10) / 10, count: ratings.length };
    }

    async getCourseRatings(courseId: string) {
        const ratings = await this.prisma.instructorRating.findMany({
            where: { courseId },
            include: { user: { select: { id: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
        const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;
        return { ratings, average: Math.round(avg * 10) / 10, count: ratings.length };
    }

    async deleteRating(ratingId: string, userId: string) {
        const rating = await this.prisma.instructorRating.findUnique({ where: { id: ratingId } });
        if (!rating) throw new NotFoundException('Rating not found');
        if (rating.userId !== userId) throw new ForbiddenException('Not your rating');
        await this.prisma.instructorRating.delete({ where: { id: ratingId } });
        return { ok: true };
    }
}
