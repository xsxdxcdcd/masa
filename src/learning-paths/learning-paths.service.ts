import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLearningPathDto, UpdateLearningPathDto } from './dto/learning-path.dto';

const publicPathInclude = {
    courses: {
        include: {
            course: {
                select: { id: true, titleAr: true, titleEn: true, categoryAr: true, categoryEn: true },
            },
        },
        orderBy: { orderIndex: 'asc' as const },
    },
};

const managedPathInclude = {
    courses: {
        include: {
            course: {
                select: { id: true, titleAr: true, titleEn: true, categoryAr: true, categoryEn: true },
            },
        },
        orderBy: { orderIndex: 'asc' as const },
    },
};

@Injectable()
export class LearningPathsService {
    constructor(private prisma: PrismaService, private audit: AuditService) {}

    private async validateCourses(courseIds: string[] = []) {
        if (!courseIds.length) return;
        const count = await this.prisma.course.count({ where: { id: { in: courseIds } } });
        if (count !== courseIds.length) throw new BadRequestException('One or more courses do not exist');
    }

    async createPath(dto: CreateLearningPathDto, creatorId: string) {
        if (!dto.titleAr.trim() || !dto.titleEn.trim()) {
            throw new BadRequestException('Titles are required');
        }
        const courseIds = dto.courseIds ?? [];
        await this.validateCourses(courseIds);

        const path = await this.prisma.learningPath.create({
            data: {
                titleAr: dto.titleAr.trim(),
                titleEn: dto.titleEn.trim(),
                descriptionAr: dto.descriptionAr?.trim() || null,
                descriptionEn: dto.descriptionEn?.trim() || null,
                coverImageUrl: dto.coverImageUrl || null,
                isPublished: dto.isPublished ?? false,
                creatorId,
                courses: {
                    create: courseIds.map((courseId, orderIndex) => ({ courseId, orderIndex })),
                },
            },
            include: managedPathInclude,
        });
        await this.audit.logAction(`Created learning path "${dto.titleAr.trim()}"`, undefined, creatorId);
        return path;
    }

    async listPaths(isPublished = false) {
        return this.prisma.learningPath.findMany({
            where: isPublished ? { isPublished: true } : {},
            include: {
                ...(isPublished ? publicPathInclude : managedPathInclude),
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    listCoursesForManagement() {
        return this.prisma.course.findMany({
            select: {
                id: true,
                titleAr: true,
                titleEn: true,
                categoryAr: true,
                categoryEn: true,
            },
            orderBy: [{ titleAr: 'asc' }, { titleEn: 'asc' }],
        });
    }

    async getPath(pathId: string, includeUnpublished = false) {
        const path = await this.prisma.learningPath.findFirst({
            where: { id: pathId, ...(includeUnpublished ? {} : { isPublished: true }) },
            include: {
                ...(includeUnpublished ? managedPathInclude : publicPathInclude),
            },
        });
        if (!path) throw new NotFoundException('Learning path not found');
        return path;
    }

    async updatePath(pathId: string, dto: UpdateLearningPathDto, userId: string, userRole: Role) {
        if (userRole !== Role.ADMIN && userRole !== Role.COURSE_MANAGER) {
            throw new NotFoundException('Learning path not found');
        }
        if (dto.titleAr !== undefined && !dto.titleAr.trim()) {
            throw new BadRequestException('Arabic title cannot be empty');
        }
        if (dto.titleEn !== undefined && !dto.titleEn.trim()) {
            throw new BadRequestException('English title cannot be empty');
        }

        const existing = await this.prisma.learningPath.findUnique({ where: { id: pathId } });
        if (!existing) throw new NotFoundException('Learning path not found');
        if (dto.courseIds !== undefined) await this.validateCourses(dto.courseIds);

        const updateData: Prisma.LearningPathUpdateInput = {
            ...(dto.titleAr !== undefined ? { titleAr: dto.titleAr.trim() } : {}),
            ...(dto.titleEn !== undefined ? { titleEn: dto.titleEn.trim() } : {}),
            ...(dto.descriptionAr !== undefined ? { descriptionAr: dto.descriptionAr.trim() || null } : {}),
            ...(dto.descriptionEn !== undefined ? { descriptionEn: dto.descriptionEn.trim() || null } : {}),
            ...(dto.coverImageUrl !== undefined ? { coverImageUrl: dto.coverImageUrl || null } : {}),
            ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        };

        await this.prisma.$transaction(async (tx) => {
            if (dto.courseIds !== undefined) {
                await tx.learningPathCourse.deleteMany({ where: { pathId } });
                updateData.courses = {
                    create: dto.courseIds.map((courseId, orderIndex) => ({ courseId, orderIndex })),
                };
            }
            await tx.learningPath.update({ where: { id: pathId }, data: updateData });
        });

        await this.audit.logAction(`Updated learning path "${existing.titleAr}"`, undefined, userId);
        return this.getPath(pathId, true);
    }

    async deletePath(pathId: string, userId: string, userRole: Role) {
        if (userRole !== Role.ADMIN && userRole !== Role.COURSE_MANAGER) {
            throw new NotFoundException('Learning path not found');
        }
        const path = await this.prisma.learningPath.findUnique({ where: { id: pathId } });
        if (!path) throw new NotFoundException('Learning path not found');
        await this.prisma.learningPath.delete({ where: { id: pathId } });
        await this.audit.logAction(`Deleted learning path "${path.titleAr}"`, undefined, userId);
        return { ok: true };
    }
}
