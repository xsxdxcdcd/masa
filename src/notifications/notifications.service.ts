import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

interface NotifyInput {
    userId: string;
    type: string;
    titleAr: string;
    titleEn: string;
    bodyAr?: string;
    bodyEn?: string;
    data?: Record<string, unknown>;
    email?: { to: string; actionUrl?: string; actionLabelAr?: string; actionLabelEn?: string };
}

@Injectable()
export class NotificationsService {
    constructor(private prisma: PrismaService, private email: EmailService) {}

    async notify(input: NotifyInput) {
        const created = await this.prisma.notification.create({
            data: {
                userId: input.userId,
                type: input.type,
                titleAr: input.titleAr,
                titleEn: input.titleEn,
                bodyAr: input.bodyAr,
                bodyEn: input.bodyEn,
                data: (input.data ?? {}) as object,
            },
        });

        if (input.email?.to) {
            await this.email.sendLocalized(
                input.email.to,
                input.titleAr,
                input.bodyAr ?? '',
                input.titleEn,
                input.bodyEn ?? '',
                input.email.actionUrl,
                input.email.actionLabelAr,
                input.email.actionLabelEn,
            );
        }
        return created;
    }

    async list(userId: string) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }

    async unreadCount(userId: string) {
        return this.prisma.notification.count({ where: { userId, readAt: null } });
    }

    async markRead(userId: string, id: string) {
        return this.prisma.notification.updateMany({
            where: { id, userId },
            data: { readAt: new Date() },
        });
    }

    async markAllRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() },
        });
    }
}