import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';
import { Role } from '@prisma/client';

@Injectable()
export class DiscussionsService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private notifications: NotificationsService,
        private gamification: GamificationService,
    ) {}

    async createPost(moduleId: string, dto: { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }, userId: string) {
        const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
        if (!mod) throw new NotFoundException('Module not found');
        if (!dto.titleAr?.trim() || !dto.bodyAr?.trim()) throw new Error('Title and body are required');
        const post = await this.prisma.discussionPost.create({
            data: {
                moduleId,
                authorId: userId,
                titleAr: dto.titleAr.trim(),
                titleEn: (dto.titleEn || dto.titleAr).trim(),
                bodyAr: dto.bodyAr.trim(),
                bodyEn: (dto.bodyEn || dto.bodyAr).trim(),
            },
            include: { author: { select: { id: true, email: true } }, _count: { select: { replies: true } } },
        });
        await this.audit.logAction(`Created discussion post in module ${moduleId}`, undefined, userId);
        this.gamification.addPoints(userId, 'discussion_post').catch(() => {});
        return post;
    }

    async listPosts(moduleId: string) {
        return this.prisma.discussionPost.findMany({
            where: { moduleId },
            include: {
                author: { select: { id: true, email: true } },
                _count: { select: { replies: true } },
            },
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        });
    }

    async getPost(postId: string) {
        const post = await this.prisma.discussionPost.findUnique({
            where: { id: postId },
            include: {
                author: { select: { id: true, email: true } },
                replies: {
                    include: { author: { select: { id: true, email: true } } },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!post) throw new NotFoundException('Post not found');
        return post;
    }

    async createReply(postId: string, dto: { bodyAr: string; bodyEn: string }, userId: string, userRole: Role) {
        const post = await this.prisma.discussionPost.findUnique({ where: { id: postId }, include: { author: true } });
        if (!post) throw new NotFoundException('Post not found');
        const reply = await this.prisma.discussionReply.create({
            data: {
                postId,
                authorId: userId,
                bodyAr: dto.bodyAr.trim(),
                bodyEn: (dto.bodyEn || dto.bodyAr).trim(),
            },
            include: { author: { select: { id: true, email: true } } },
        });
        if (post.authorId !== userId && userRole === Role.STUDENT) {
            this.notifications.notify({
                userId: post.authorId,
                type: 'discussion.reply',
                titleAr: 'رد على منشورك',
                titleEn: 'Reply to your post',
                bodyAr: `رد شخص على منشورك "${post.titleAr}"`,
                bodyEn: `Someone replied to your post "${post.titleEn}"`,
                data: { postId },
            }).catch(() => {});
        }
        this.gamification.addPoints(userId, 'discussion_reply').catch(() => {});
        return reply;
    }

    async toggleResolved(postId: string, userId: string, userRole: Role) {
        const post = await this.prisma.discussionPost.findUnique({ where: { id: postId }, include: { module: { include: { course: true } } } });
        if (!post) throw new NotFoundException('Post not found');
        const isStaff = userRole === Role.ADMIN || userRole === Role.COURSE_MANAGER;
        const isInstructor = userRole === Role.INSTRUCTOR && post.module.course.instructorId === userId;
        if (post.authorId !== userId && !isStaff && !isInstructor) throw new ForbiddenException('Not allowed');
        return this.prisma.discussionPost.update({ where: { id: postId }, data: { isResolved: !post.isResolved } });
    }

    async deletePost(postId: string, userId: string, userRole: Role) {
        const post = await this.prisma.discussionPost.findUnique({ where: { id: postId }, include: { module: { include: { course: true } } } });
        if (!post) throw new NotFoundException('Post not found');
        const isStaff = userRole === Role.ADMIN || userRole === Role.COURSE_MANAGER;
        const isInstructor = userRole === Role.INSTRUCTOR && post.module.course.instructorId === userId;
        if (post.authorId !== userId && !isStaff && !isInstructor) throw new ForbiddenException('Not allowed');
        await this.prisma.discussionPost.delete({ where: { id: postId } });
        return { ok: true };
    }

    async deleteReply(replyId: string, userId: string, userRole: Role) {
        const reply = await this.prisma.discussionReply.findUnique({ where: { id: replyId }, include: { post: { include: { module: { include: { course: true } } } } } });
        if (!reply) throw new NotFoundException('Reply not found');
        const isStaff = userRole === Role.ADMIN || userRole === Role.COURSE_MANAGER;
        const isInstructor = userRole === Role.INSTRUCTOR && reply.post.module.course.instructorId === userId;
        if (reply.authorId !== userId && !isStaff && !isInstructor) throw new ForbiddenException('Not allowed');
        await this.prisma.discussionReply.delete({ where: { id: replyId } });
        return { ok: true };
    }
}
