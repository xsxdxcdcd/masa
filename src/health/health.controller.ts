import { Controller, Get, UseGuards, Res, NotFoundException, ForbiddenException, Param } from '@nestjs/common';
import { HealthCheckService, HealthCheck, PrismaHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

@ApiTags('Health & Admin Stats')
@Controller()
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private prismaHealth: PrismaHealthIndicator,
        private memoryHealth: MemoryHealthIndicator,
        private prisma: PrismaService,
    ) { }

    @Get('health')
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.prismaHealth.pingCheck('database', this.prisma),
            () => this.memoryHealth.checkHeap('memory_heap', 250 * 1024 * 1024),
        ]);
    }

    // Upload proxy. Course media & chat attachments are served publicly
    // (the frontend embeds these URLs in <img>/<video> tags, which cannot
    // send Authorization headers). Receipts and CVs are BLOCKED here and in
    // main.ts' static handler — they are private files, reachable only via
    // the authenticated download endpoints. Filenames are random/obfuscated.
    @Get('uploads/*')
    async serveUpload(
        @Param() params: { 0: string },
        @Res() res: Response,
    ) {
        const key = params[0] || '';
        if (
            key === 'receipts' || key.startsWith('receipts/') ||
            key === 'cvs' || key.startsWith('cvs/') ||
            key === 'private' || key.startsWith('private/')
        ) {
            throw new NotFoundException('File not found');
        }
        const filePath = join(process.cwd(), 'uploads', params[0]);
        if (!existsSync(filePath)) {
            throw new NotFoundException('File not found');
        }
        // Basic path traversal protection
        const resolved = require('path').resolve(filePath);
        const uploadsRoot = require('path').resolve(join(process.cwd(), 'uploads'));
        if (!resolved.startsWith(uploadsRoot)) {
            throw new ForbiddenException('Access denied');
        }
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Allow the frontend origin to embed uploaded media (helmet defaults CORP to same-origin)
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        // Only preview-safe media types render inline; everything else downloads.
        const inline = /\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i.test(resolved);
        if (!inline) {
            const name = (resolved.split(/[\\/]/).pop() || 'file').replace(/["\\\r\n]/g, '');
            res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        }
        return res.sendFile(resolved);
    }

    @ApiOperation({ summary: 'Admin dashboard aggregate stats' })
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(Role.ADMIN)
    @RequirePermissions(PERMISSIONS.SYSTEM_READ)
    @Get('admin/stats')
    async adminStats() {
        const [
            totalUsers,
            usersByRole,
            totalCourses,
            openCourseCount,
            totalEnrollments,
            pendingEnrollments,
            totalPayments,
            revenueSum,
            pendingApps,
            totalAuditEvents,
            totalGateways,
            activeGateways,
            totalTickets,
            openTickets,
            totalModules,
            totalLessonsCompleted,
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.user.groupBy({ by: ['role'], _count: true }),
            this.prisma.course.count(),
            this.prisma.courseOpening.count({ where: { isPublished: true } }),
            this.prisma.enrollment.count(),
            this.prisma.enrollment.count({ where: { status: 'PENDING' } }),
            this.prisma.payment.count(),
            this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }),
            this.prisma.instructorApplication.count({ where: { status: 'PENDING' } }),
            this.prisma.auditLog.count(),
            this.prisma.paymentGateway.count(),
            this.prisma.paymentGateway.count({ where: { isActive: true } }),
            this.prisma.supportTicket.count(),
            this.prisma.supportTicket.count({ where: { status: { not: 'CLOSED' } } }),
            this.prisma.module.count(),
            this.prisma.lessonProgress.count(),
        ]);

        const roleMap: Record<string, number> = {};
        usersByRole.forEach((r: { role: string; _count: number }) => { roleMap[r.role] = r._count; });

        return {
            users: {
                total: totalUsers,
                students: roleMap['STUDENT'] || 0,
                instructors: roleMap['INSTRUCTOR'] || 0,
                finance: roleMap['FINANCE'] || 0,
                courseManagers: roleMap['COURSE_MANAGER'] || 0,
                admins: roleMap['ADMIN'] || 0,
            },
            courses: {
                total: totalCourses,
                open: openCourseCount,
                closed: totalCourses - openCourseCount,
                totalModules,
                totalLessonsCompleted,
            },
            enrollments: {
                total: totalEnrollments,
                pending: pendingEnrollments,
                approved: await this.prisma.enrollment.count({ where: { status: 'APPROVED' } }),
                rejected: await this.prisma.enrollment.count({ where: { status: 'REJECTED' } }),
            },
            payments: {
                total: totalPayments,
                revenue: Number(revenueSum._sum.amount || 0),
            },
            instructorApplications: {
                pending: pendingApps,
                total: await this.prisma.instructorApplication.count(),
            },
            support: {
                total: totalTickets,
                open: openTickets,
            },
            gateways: {
                total: totalGateways,
                active: activeGateways,
            },
            audit: {
                totalEvents: totalAuditEvents,
            },
        };
    }
}
