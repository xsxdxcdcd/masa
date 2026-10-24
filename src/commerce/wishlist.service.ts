import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.wishlist.findMany({
      where: { userId },
      include: {
        course: {
          include: { instructor: { select: { id: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggle(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const existing = await this.prisma.wishlist.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (existing) {
      await this.prisma.wishlist.delete({ where: { id: existing.id } });
      return { saved: false };
    }
    await this.prisma.wishlist.create({ data: { userId, courseId } });
    return { saved: true };
  }

  async status(userId: string, courseId: string) {
    const existing = await this.prisma.wishlist.findUnique({ where: { userId_courseId: { userId, courseId } } });
    return { saved: Boolean(existing) };
  }

  async remove(userId: string, courseId: string) {
    await this.prisma.wishlist.deleteMany({ where: { userId, courseId } });
    return { saved: false };
  }
}