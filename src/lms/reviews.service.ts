import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async upsert(userId: string, data: { courseId: string; rating: number; commentAr?: string; commentEn?: string }) {
    const rating = Number(data.rating);
    if (!data.courseId) throw new BadRequestException('courseId is required');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException('Rating must be an integer between 1 and 5');

    const course = await this.prisma.course.findUnique({ where: { id: data.courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: userId, courseId: data.courseId } },
    });
    if (!enrollment || enrollment.status !== 'APPROVED') throw new ForbiddenException('Only enrolled students can review a course');

    return this.prisma.courseReview.upsert({
      where: { courseId_userId: { courseId: data.courseId, userId } },
      update: { rating, commentAr: data.commentAr, commentEn: data.commentEn },
      create: { courseId: data.courseId, userId, rating, commentAr: data.commentAr, commentEn: data.commentEn, isPublished: false },
    });
  }

  async listForCourse(courseId: string) {
    const reviews = await this.prisma.courseReview.findMany({
      where: { courseId, isPublished: true },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const total = reviews.length;
    const average = total === 0 ? 0 : reviews.reduce((s, r) => s + r.rating, 0) / total;
    const distribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((r) => r.rating === stars).length }));
    return { total, average: Number(average.toFixed(2)), distribution, reviews };
  }

  async setModeration(id: string, isPublished: boolean) {
    const review = await this.prisma.courseReview.update({ where: { id }, data: { isPublished } });
    return review;
  }
}