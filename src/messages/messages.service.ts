import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { Role } from '@prisma/client';

@Injectable()
export class MessagesService {
    constructor(
        private prisma: PrismaService,
        private encryption: EncryptionService,
    ) { }

    private async getCourseOrThrow(courseId: string) {
        const course = await this.prisma.course.findUnique({ where: { id: courseId } });
        if (!course) throw new NotFoundException('Course not found');
        return course;
    }

    private async isEnrolled(studentId: string, courseId: string) {
        const enrollment = await this.prisma.enrollment.findUnique({
            where: { studentId_courseId: { studentId, courseId } },
        });
        return !!enrollment;
    }

    private async validateSend(user: { userId: string; role: Role }, recipientId: string, courseId?: string) {
        if (!recipientId) throw new BadRequestException('recipientId is required');
        if (recipientId === user.userId) throw new BadRequestException('Cannot message yourself');

        const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
        if (!recipient) throw new NotFoundException('Recipient not found');

        if (courseId) {
            const course = await this.getCourseOrThrow(courseId);
            // Course-scoped threads:
            // - STUDENT  -> may talk only to the course instructor of a course they are enrolled in
            // - INSTRUCTOR -> may talk to students of the course they teach (or an admin)
            // - ADMIN/CM/FINANCE -> any participant
            if (user.role === Role.STUDENT) {
                const enrolled = await this.isEnrolled(user.userId, courseId);
                if (!enrolled) throw new ForbiddenException('You are not enrolled in this course');
                if (recipient.id !== course.instructorId) {
                    throw new ForbiddenException('Students can only message the instructor of the course');
                }
            } else if (user.role === Role.INSTRUCTOR) {
                const isCourseInstructor = course.instructorId === user.userId;
                const isOpeningInstructor = await this.prisma.courseOpening.count({
                    where: { courseId, instructorId: user.userId },
                }) > 0;
                if (!isCourseInstructor && !isOpeningInstructor) {
                    throw new ForbiddenException('You do not teach this course');
                }
                if (recipient.role !== Role.STUDENT && recipient.role !== Role.ADMIN) {
                    throw new ForbiddenException('Instructors can only message their students or platform admins');
                }
            }
            return recipient;
        }

        // Direct (non course) threads:
        // - STUDENT -> only platform admins (support)
        if (user.role === Role.STUDENT && recipient.role !== Role.ADMIN) {
            throw new ForbiddenException('Students can only message platform admins for support');
        }
        return recipient;
    }

    async send(user: { userId: string; role: Role }, dto: { recipientId: string; courseId?: string; content: string }) {
        if (!dto.content || !dto.content.trim()) {
            throw new BadRequestException('Message content is required');
        }
        const recipient = await this.validateSend(user, dto.recipientId, dto.courseId);
        const message = await this.prisma.message.create({
            data: {
                senderId: user.userId,
                recipientId: dto.recipientId,
                courseId: dto.courseId ?? null,
                content: this.encryption.encrypt(dto.content.trim()),
            },
            include: {
                sender: { select: { id: true, email: true, role: true } },
                recipient: { select: { id: true, email: true, role: true } },
            },
        });
        return { ...message, content: this.encryption.tryDecrypt(message.content), recipientEmail: recipient.email };
    }

    async getConversations(userId: string) {
        const messages = await this.prisma.message.findMany({
            where: {
                OR: [{ senderId: userId }, { recipientId: userId }],
            },
            include: {
                sender: { select: { id: true, email: true, role: true } },
                recipient: { select: { id: true, email: true, role: true } },
                course: { select: { id: true, titleAr: true, titleEn: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        const groups = new Map<string, typeof messages>();
        for (const m of messages) {
            const otherId = m.senderId === userId ? m.recipientId : m.senderId;
            const key = `${otherId}|${m.courseId ?? ''}`;
            const list = groups.get(key) ?? [];
            list.push(m);
            groups.set(key, list);
        }

        const conversations = Array.from(groups.entries()).map(([key, msgs]) => {
            const last = msgs[msgs.length - 1];
            const otherId = last.senderId === userId ? last.recipientId : last.senderId;
            const other = last.senderId === userId ? last.recipient : last.sender;
            const unreadCount = msgs.filter((m) => m.recipientId === userId && !m.readAt).length;
            return {
                id: key,
                otherUser: { id: other.id, email: other.email, role: other.role },
                course: last.course
                    ? { id: last.course.id, titleAr: last.course.titleAr, titleEn: last.course.titleEn }
                    : null,
                lastMessage: {
                    content: this.encryption.tryDecrypt(last.content),
                    createdAt: last.createdAt,
                    fromMe: last.senderId === userId,
                    read: !!last.readAt,
                },
                unreadCount,
                updatedAt: last.createdAt,
            };
        });

        conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return conversations;
    }

    async getThread(userId: string, otherId: string, courseId?: string) {
        if (!otherId) throw new BadRequestException('with (userId) is required');
        const where: any = {
            OR: [
                { senderId: userId, recipientId: otherId },
                { senderId: otherId, recipientId: userId },
            ],
        };
        if (courseId) {
            where.courseId = courseId;
            await this.getCourseOrThrow(courseId);
        }
        return this.prisma.message.findMany({
            where,
            include: {
                sender: { select: { id: true, email: true, role: true } },
            },
            orderBy: { createdAt: 'asc' },
        }).then((messages) => messages.map((m) => ({ ...m, content: this.encryption.tryDecrypt(m.content) })));
    }

    async markRead(userId: string, otherId: string, courseId?: string) {
        if (!otherId) throw new BadRequestException('with (userId) is required');
        const where: any = {
            senderId: otherId,
            recipientId: userId,
            readAt: null,
        };
        if (courseId) where.courseId = courseId;
        const result = await this.prisma.message.updateMany({
            where,
            data: { readAt: new Date() },
        });
        return { updated: result.count };
    }

    async getUnreadCount(userId: string) {
        const count = await this.prisma.message.count({
            where: { recipientId: userId, readAt: null },
        });
        return { count };
    }

    async getSupportAdmins() {
        return this.prisma.user.findMany({
            where: { role: Role.ADMIN, isActive: true },
            select: { id: true, email: true, role: true },
            orderBy: { createdAt: 'asc' },
        });
    }

    async getContacts(user: { userId: string; role: Role }) {
        const admins = await this.getSupportAdmins();

        if (user.role === Role.STUDENT) {
            const enrollments = await this.prisma.enrollment.findMany({
                where: { studentId: user.userId },
                include: {
                    course: {
                        select: {
                            id: true,
                            titleAr: true,
                            titleEn: true,
                            instructor: { select: { id: true, email: true, role: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            const instructors = enrollments
                .filter((e) => e.course.instructor && e.course.instructor.id !== user.userId)
                .map((e) => ({
                    id: e.course.instructor.id,
                    email: e.course.instructor.email,
                    role: e.course.instructor.role,
                    course: { id: e.course.id, titleAr: e.course.titleAr, titleEn: e.course.titleEn },
                }));
            return { admins, instructors };
        }

        if (user.role === Role.INSTRUCTOR) {
            const courses = await this.prisma.course.findMany({
                where: { OR: [{ instructorId: user.userId }, { openings: { some: { instructorId: user.userId } } }] },
                select: {
                    id: true,
                    titleAr: true,
                    titleEn: true,
                    enrollments: { select: { student: { select: { id: true, email: true, role: true } } } },
                },
            });
            const students = Array.from(
                new Map(
                    courses.flatMap((c) =>
                        c.enrollments.map((e) => [
                            e.student.id,
                            {
                                id: e.student.id,
                                email: e.student.email,
                                role: e.student.role,
                                course: { id: c.id, titleAr: c.titleAr, titleEn: c.titleEn },
                            },
                        ])
                    )
                ).values()
            );
            return { admins, instructors: [], students };
        }

        const students = await this.prisma.user.findMany({
            where: { role: Role.STUDENT, isActive: true },
            select: { id: true, email: true, role: true },
            orderBy: { createdAt: 'asc' },
        });
        return { admins, instructors: [], students };
    }
}
