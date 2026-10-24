import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AnalyticsService {
    constructor(private prisma: PrismaService) {}

    private async assertEnrolled(userId: string, courseId: string) {
        const enrollment = await this.prisma.enrollment.findFirst({
            where: { studentId: userId, courseId, status: { in: ['APPROVED', 'RESERVED'] } },
            select: { id: true },
        });
        if (!enrollment) {
            throw new ForbiddenException('You are not enrolled in this course');
        }
    }

    async startSession(userId: string, courseId: string, moduleId?: string) {
        await this.assertEnrolled(userId, courseId);
        const session = await this.prisma.learningSession.create({
            data: { userId, courseId, moduleId: moduleId || null, durationSec: 0 },
        });
        return session;
    }

    async heartbeat(sessionId: string, userId: string) {
        const session = await this.prisma.learningSession.findFirst({ where: { id: sessionId, userId } });
        if (!session) throw new NotFoundException('Session not found');
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - session.lastHeartbeat.getTime()) / 1000);
        const updated = await this.prisma.learningSession.updateMany({
            where: { id: sessionId, userId },
            data: { lastHeartbeat: now, durationSec: session.durationSec + Math.min(elapsed, 120) },
        });
        if (updated.count === 0) throw new NotFoundException('Session not found');
        return this.prisma.learningSession.findUnique({ where: { id: sessionId } });
    }

    async getStudentAnalytics(userId: string) {
        const sessions = await this.prisma.learningSession.findMany({
            where: { userId },
            include: { course: { select: { id: true, titleAr: true, titleEn: true } } },
            orderBy: { startedAt: 'desc' },
        });
        const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSec, 0);
        const totalHours = Math.round(totalSeconds / 3600 * 10) / 10;
        const totalMinutes = Math.round(totalSeconds / 60);

        const coursesStudied = new Set(sessions.map(s => s.courseId)).size;

        const enrollments = await this.prisma.enrollment.findMany({
            where: { studentId: userId, status: 'APPROVED' },
            include: {
                course: { select: { id: true, titleAr: true, titleEn: true } },
                opening: { select: { id: true, status: true } },
            },
        });

        const coursesInProgress = enrollments.filter(e => e.opening?.status !== 'ENDED').length;
        const coursesCompleted = enrollments.filter(e => e.opening?.status === 'ENDED').length;

        const byCourse = enrollments.map(e => {
            const courseSessions = sessions.filter(s => s.courseId === e.course.id);
            const totalSec = courseSessions.reduce((sum, s) => sum + s.durationSec, 0);
            return {
                courseId: e.course.id,
                courseTitleAr: e.course.titleAr,
                courseTitleEn: e.course.titleEn,
                totalMinutes: Math.round(totalSec / 60),
                sessionsCount: courseSessions.length,
                isCompleted: e.opening?.status === 'ENDED',
            };
        });

        const points = await this.prisma.userPoints.findUnique({ where: { userId } });
        const pointLogs = await this.prisma.pointLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 30,
        });

        return {
            totalHours,
            totalMinutes,
            coursesStudied,
            coursesInProgress,
            coursesCompleted,
            byCourse,
            points: points?.points || 0,
            level: points?.level || 1,
            streak: points?.streak || 0,
            recentActivity: pointLogs,
        };
    }

    async getCourseAnalytics(courseId: string, userId: string, role: Role) {
        const adminOrManager = role === Role.ADMIN || role === Role.COURSE_MANAGER;
        if (!adminOrManager) {
            const owned = await this.prisma.course.findFirst({
                where: { id: courseId, instructorId: userId },
                select: { id: true },
            });
            if (!owned) throw new ForbiddenException('You do not own this course');
        }

        const enrollments = await this.prisma.enrollment.findMany({
            where: { courseId, status: 'APPROVED' },
        });
        const sessions = await this.prisma.learningSession.findMany({ where: { courseId } });
        const totalStudents = enrollments.length;
        const totalMinutes = sessions.reduce((sum, s) => sum + s.durationSec, 0) / 60;
        const avgMinutesPerStudent = totalStudents > 0 ? Math.round(totalMinutes / totalStudents) : 0;

        const completedModules = await this.prisma.lessonProgress.count({
            where: { enrollment: { courseId } },
        });

        return {
            totalStudents,
            totalMinutes: Math.round(totalMinutes),
            avgMinutesPerStudent,
            completedModules,
            totalSessions: sessions.length,
        };
    }

    async getStudentCourseAnalytics(userId: string, courseId: string) {
        await this.assertEnrolled(userId, courseId);

        const sessions = await this.prisma.learningSession.findMany({
            where: { userId, courseId },
            orderBy: { startedAt: 'asc' },
        });
        const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSec, 0);

        const moduleProgress = await this.prisma.lessonProgress.findMany({
            where: { enrollment: { studentId: userId, courseId } },
            include: { module: { select: { id: true, titleAr: true, titleEn: true, orderIndex: true } } },
        });

        return {
            totalMinutes: Math.round(totalSeconds / 60),
            sessionsCount: sessions.length,
            moduleProgress: moduleProgress.map(p => ({
                moduleId: p.module.id,
                moduleTitleAr: p.module.titleAr,
                moduleTitleEn: p.module.titleEn,
                completed: true,
            })),
        };
    }
}
