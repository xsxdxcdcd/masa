import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { resolvePrivateUpload } from '../common/private-uploads';
import { UserCacheService } from '../common/user-cache.service';

@Injectable()
export class InstructorApplicationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
        private readonly userCache: UserCacheService
    ) { }

    async getApplications() {
        return this.prisma.instructorApplication.findMany({
            include: { user: { select: { email: true, id: true } } },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getMyApplication(userId: string) {
        return this.prisma.instructorApplication.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
    }

    async createApplication(userId: string, data: any, cvFileUrl: string) {
        const app = await this.prisma.instructorApplication.create({
            data: {
                userId,
                name: data.name,
                bio: data.bio,
                specialty: data.specialty,
                videoIntroUrl: data.videoIntroUrl,
                cvFileUrl,
            }
        });

        await this.auditService.logAction('CREATE_INSTRUCTOR_APP', undefined, userId);
        return app;
    }

    async updateApplicationStatus(id: string, status: 'APPROVED' | 'REJECTED', adminId: string) {
        const app = await this.prisma.instructorApplication.update({
            where: { id },
            data: { status }
        });

        await this.auditService.logAction(`UPDATE_INSTRUCTOR_APP_${status}`, undefined, adminId);

        if (status === 'APPROVED') {
            // The application already holds a name, a professional bio and a
            // specialty that the applicant typed. Promoting the role without
            // copying them left an approved instructor with an empty metadata
            // blob, so their public profile had no name, no bio and no avatar
            // fallback — the pages fell back to the account email. Seed the
            // public fields on approval; the instructor can edit them afterwards
            // from the profile page.
            const current = await this.prisma.user.findUnique({
                where: { id: app.userId },
                select: { metadata: true },
            });
            const md = ((current?.metadata ?? {}) as Record<string, unknown>) ?? {};
            const seeded: Record<string, unknown> = { ...md };
            if (typeof md.fullName !== 'string' || !md.fullName.trim()) {
                seeded.fullName = app.name?.trim() || undefined;
            }
            if (typeof md.nameAr !== 'string' || !md.nameAr.trim()) {
                seeded.nameAr = app.name?.trim() || undefined;
            }
            if (typeof md.bio !== 'string' || !md.bio.trim()) {
                seeded.bio = app.bio?.trim() || undefined;
            }
            if (typeof md.specialty !== 'string' || !md.specialty.trim()) {
                seeded.specialty = app.specialty?.trim() || undefined;
            }

            await this.prisma.user.update({
                where: { id: app.userId },
                data: { role: 'INSTRUCTOR', metadata: seeded as any },
            });
            // Promotion happens here rather than through updateRole, so it needs
            // its own invalidation: otherwise the applicant's existing session
            // would keep the STUDENT role cached and lose instructor access until
            // the TTL ran out.
            await this.userCache.invalidate(app.userId);
            await this.auditService.logAction(`UPDATE_ROLE_INSTRUCTOR`, undefined, adminId);
        }

        return app;
    }

    /**
     * Resolve the absolute path of an application's CV file. Caller identity is
     * enforced by the controller's ADMIN/COURSE_MANAGER role guard.
     */
    async getCvPath(applicationId: string) {
        const app = await this.prisma.instructorApplication.findUnique({ where: { id: applicationId } });
        if (!app) throw new NotFoundException('Application not found');
        if (!app.cvFileUrl) throw new NotFoundException('No CV on file');
        return resolvePrivateUpload(app.cvFileUrl, ['cvs']);
    }
}
