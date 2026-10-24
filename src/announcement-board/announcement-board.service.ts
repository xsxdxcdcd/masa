import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnnouncementBoardService {
    private readonly logger = new Logger(AnnouncementBoardService.name);
    constructor(private prisma: PrismaService) {}

    async findAll() {
        return this.prisma.announcementBoard.findMany({
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
            include: { author: { select: { id: true, email: true } } },
        });
    }

    async findActive() {
        const now = new Date();
        return this.prisma.announcementBoard.findMany({
            where: {
                isActive: true,
                OR: [
                    { startsAt: null },
                    { startsAt: { lte: now } },
                ],
                AND: [
                    { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
                ],
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
            select: {
                id: true,
                titleAr: true,
                titleEn: true,
                bodyAr: true,
                bodyEn: true,
                mediaType: true,
                mediaUrl: true,
                linkUrl: true,
                priority: true,
                durationSeconds: true,
            },
        });
    }

    async findOne(id: string) {
        const item = await this.prisma.announcementBoard.findUnique({
            where: { id },
            include: { author: { select: { id: true, email: true } } },
        });
        if (!item) throw new NotFoundException('Announcement not found');
        return item;
    }

    async create(data: {
        titleAr: string;
        titleEn: string;
        bodyAr?: string;
        bodyEn?: string;
        mediaType?: string;
        mediaUrl?: string;
        linkUrl?: string;
        priority?: number;
        isActive?: boolean;
        durationSeconds?: number;
        startsAt?: Date;
        expiresAt?: Date;
        authorId: string;
    }) {
        this.logger.log(`Creating announcement: ${JSON.stringify({ titleAr: data.titleAr, titleEn: data.titleEn, authorId: data.authorId })}`);
        return this.prisma.announcementBoard.create({
            data: {
                titleAr: data.titleAr,
                titleEn: data.titleEn,
                bodyAr: data.bodyAr,
                bodyEn: data.bodyEn,
                mediaType: data.mediaType ?? 'none',
                mediaUrl: data.mediaUrl,
                linkUrl: data.linkUrl,
                priority: data.priority ?? 0,
                isActive: data.isActive ?? true,
                durationSeconds: data.durationSeconds ?? 5,
                startsAt: data.startsAt,
                expiresAt: data.expiresAt,
                authorId: data.authorId,
            },
        });
    }

    async update(id: string, body: Record<string, any>) {
        await this.findOne(id);
        const allowed: Record<string, any> = {};
        const fields = ['titleAr','titleEn','bodyAr','bodyEn','mediaType','mediaUrl','linkUrl','priority','isActive','durationSeconds','startsAt','expiresAt'] as const;
        for (const f of fields) {
            if (f in body) allowed[f] = body[f] ?? null;
        }
        return this.prisma.announcementBoard.update({ where: { id }, data: allowed });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.announcementBoard.delete({ where: { id } });
    }
}
