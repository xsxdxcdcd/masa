import { Controller, Get, Post, Patch, Delete, Put, Param, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GradesService } from './grades.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';

const STAFF_ROLES = [Role.ADMIN, Role.COURSE_MANAGER, Role.INSTRUCTOR];

@ApiTags('Grades & Roster (الطلاب والدرجات)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(...STAFF_ROLES)
@Controller()
export class GradesController {
    constructor(private readonly gradesService: GradesService) { }

    @ApiOperation({ summary: 'Roster of enrolled students + grades for an opening (own openings only for instructors)' })
    @RequirePermissions(PERMISSIONS.GRADES_READ)
    @Get('openings/:openingId/roster')
    roster(@Param('openingId') openingId: string, @Request() req: any) {
        return this.gradesService.getRoster(openingId, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'List assessment components for an opening (own openings only for instructors)' })
    @RequirePermissions(PERMISSIONS.GRADES_READ)
    @Get('openings/:openingId/assessments')
    assessments(@Param('openingId') openingId: string, @Request() req: any) {
        return this.gradesService.listAssessments(openingId, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Create an assessment component' })
    @RequirePermissions(PERMISSIONS.GRADES_WRITE)
    @Post('openings/:openingId/assessments')
    createAssessment(
        @Param('openingId') openingId: string,
        @Body('nameAr') nameAr: string,
        @Body('nameEn') nameEn: string,
        @Body('maxScore') maxScore: number | undefined,
        @Body('orderIndex') orderIndex: number | undefined,
        @Request() req: any,
    ) {
        return this.gradesService.createAssessment(openingId, { nameAr, nameEn, maxScore, orderIndex }, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Update an assessment component' })
    @RequirePermissions(PERMISSIONS.GRADES_WRITE)
    @Patch('assessments/:id')
    updateAssessment(
        @Param('id') id: string,
        @Body('nameAr') nameAr: string | undefined,
        @Body('nameEn') nameEn: string | undefined,
        @Body('maxScore') maxScore: number | undefined,
        @Body('orderIndex') orderIndex: number | undefined,
        @Request() req: any,
    ) {
        return this.gradesService.updateAssessment(id, { nameAr, nameEn, maxScore, orderIndex }, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Delete an assessment component' })
    @RequirePermissions(PERMISSIONS.GRADES_WRITE)
    @Delete('assessments/:id')
    deleteAssessment(@Param('id') id: string, @Request() req: any) {
        return this.gradesService.deleteAssessment(id, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Create or update a grade for an enrollment + assessment' })
    @RequirePermissions(PERMISSIONS.GRADES_WRITE)
    @Put('grades')
    upsertGrade(
        @Body('enrollmentId') enrollmentId: string,
        @Body('assessmentId') assessmentId: string,
        @Body('score') score: number,
        @Body('notes') notes: string | undefined,
        @Request() req: any,
    ) {
        if (enrollmentId == null || assessmentId == null || score == null) {
            throw new BadRequestException('enrollmentId, assessmentId and score are required');
        }
        return this.gradesService.upsertGrade({ enrollmentId, assessmentId, score, notes }, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Delete a grade' })
    @RequirePermissions(PERMISSIONS.GRADES_WRITE)
    @Delete('grades/:enrollmentId/:assessmentId')
    deleteGrade(@Param('enrollmentId') enrollmentId: string, @Param('assessmentId') assessmentId: string, @Request() req: any) {
        return this.gradesService.deleteGrade(enrollmentId, assessmentId, req.user.userId, req.user.role);
    }
}