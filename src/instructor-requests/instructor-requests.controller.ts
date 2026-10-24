import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InstructorRequestsService } from './instructor-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role, ApplicationStatus } from '@prisma/client';

const REVIEW_ROLES = [Role.ADMIN, Role.COURSE_MANAGER];

@ApiTags('Instructor Requests (طلبات المدرّس)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('instructor-requests')
export class InstructorRequestsController {
    constructor(private readonly service: InstructorRequestsService) { }

    // ---------- Opening requests (طلب فتح الدورة) ----------

    @ApiOperation({ summary: 'Instructor requests to open a course (admin creates the opening after approval)' })
    @ApiResponse({ status: 201, description: 'Request created.' })
    @Roles(Role.INSTRUCTOR)
    @Post('openings')
    createOpeningRequest(
        @Body('courseId') courseId: string,
        @Body('reason') reason: string | undefined,
        @Request() req: any,
    ) {
        return this.service.createOpeningRequest(req.user.userId, { courseId, reason });
    }

    @ApiOperation({ summary: 'My opening requests (instructor)' })
    @Roles(Role.INSTRUCTOR)
    @Get('openings/my')
    myOpeningRequests(@Request() req: any) {
        return this.service.getMyOpeningRequests(req.user.userId);
    }

    @ApiOperation({ summary: 'All opening requests (admin/course manager)' })
    @Roles(...REVIEW_ROLES)
    @RequirePermissions(PERMISSIONS.INSTRUCTORS_READ)
    @Get('openings')
    allOpeningRequests() {
        return this.service.getAllOpeningRequests();
    }

    @ApiOperation({ summary: 'Approve/reject an opening request' })
    @Roles(...REVIEW_ROLES)
    @RequirePermissions(PERMISSIONS.INSTRUCTORS_REVIEW)
    @Patch('openings/:id/status')
    reviewOpeningRequest(
        @Param('id') id: string,
        @Body('status') status: ApplicationStatus,
        @Request() req: any,
    ) {
        if (!status || !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
            throw new BadRequestException('status must be PENDING, APPROVED or REJECTED');
        }
        return this.service.reviewOpeningRequest(id, status, req.user.userId);
    }

    @ApiOperation({ summary: 'Delete an opening request' })
    @Roles(...REVIEW_ROLES)
    @RequirePermissions(PERMISSIONS.INSTRUCTORS_REVIEW)
    @Delete('openings/:id')
    deleteOpeningRequest(@Param('id') id: string) {
        return this.service.deleteOpeningRequest(id);
    }

    // ---------- Close requests (طلب إيقاف/إنهاء الدورة) ----------

    @ApiOperation({ summary: 'Instructor requests to close/end their opening' })
    @ApiResponse({ status: 201, description: 'Request created.' })
    @Roles(Role.INSTRUCTOR)
    @Post('closures')
    createCloseRequest(
        @Body('openingId') openingId: string,
        @Body('reason') reason: string | undefined,
        @Request() req: any,
    ) {
        return this.service.createCloseRequest(req.user.userId, { openingId, reason });
    }

    @ApiOperation({ summary: 'My close requests (instructor)' })
    @Roles(Role.INSTRUCTOR)
    @Get('closures/my')
    myCloseRequests(@Request() req: any) {
        return this.service.getMyCloseRequests(req.user.userId);
    }

    @ApiOperation({ summary: 'All close requests (admin/course manager)' })
    @Roles(...REVIEW_ROLES)
    @RequirePermissions(PERMISSIONS.INSTRUCTORS_READ)
    @Get('closures')
    allCloseRequests() {
        return this.service.getAllCloseRequests();
    }

    @ApiOperation({ summary: 'Approve/reject a close request (approve ends the course + issues certificates)' })
    @Roles(...REVIEW_ROLES)
    @RequirePermissions(PERMISSIONS.INSTRUCTORS_REVIEW)
    @Patch('closures/:id/status')
    reviewCloseRequest(
        @Param('id') id: string,
        @Body('status') status: ApplicationStatus,
        @Request() req: any,
    ) {
        if (!status || !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
            throw new BadRequestException('status must be PENDING, APPROVED or REJECTED');
        }
        return this.service.reviewCloseRequest(id, status, req.user.userId);
    }

    @ApiOperation({ summary: 'Delete a close request' })
    @Roles(...REVIEW_ROLES)
    @RequirePermissions(PERMISSIONS.INSTRUCTORS_REVIEW)
    @Delete('closures/:id')
    deleteCloseRequest(@Param('id') id: string) {
        return this.service.deleteCloseRequest(id);
    }

    // ---------- Course suggestions (اقتراح دورة جديدة) ----------

    @ApiOperation({ summary: 'Instructor suggests a new course' })
    @ApiResponse({ status: 201, description: 'Suggestion created.' })
    @Roles(Role.INSTRUCTOR)
    @Post('suggestions')
    createSuggestion(
        @Body('titleAr') titleAr: string,
        @Body('titleEn') titleEn: string,
        @Body('categoryAr') categoryAr: string | undefined,
        @Body('categoryEn') categoryEn: string | undefined,
        @Body('description') description: string | undefined,
        @Request() req: any,
    ) {
        return this.service.createSuggestion(req.user.userId, { titleAr, titleEn, categoryAr, categoryEn, description });
    }

    @ApiOperation({ summary: 'My course suggestions (instructor)' })
    @Roles(Role.INSTRUCTOR)
    @Get('suggestions/my')
    mySuggestions(@Request() req: any) {
        return this.service.getMySuggestions(req.user.userId);
    }

    @ApiOperation({ summary: 'All course suggestions (admin/course manager)' })
    @Roles(...REVIEW_ROLES)
    @RequirePermissions(PERMISSIONS.INSTRUCTORS_READ)
    @Get('suggestions')
    allSuggestions() {
        return this.service.getAllSuggestions();
    }

    @ApiOperation({ summary: 'Approve/reject a course suggestion (approve creates the course)' })
    @Roles(...REVIEW_ROLES)
    @RequirePermissions(PERMISSIONS.INSTRUCTORS_REVIEW)
    @Patch('suggestions/:id/status')
    reviewSuggestion(
        @Param('id') id: string,
        @Body('status') status: ApplicationStatus,
        @Body('reviewNotes') reviewNotes: string | undefined,
        @Request() req: any,
    ) {
        if (!status || !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
            throw new BadRequestException('status must be PENDING, APPROVED or REJECTED');
        }
        return this.service.reviewSuggestion(id, status, req.user.userId, reviewNotes);
    }

    @ApiOperation({ summary: 'Delete a course suggestion' })
    @Roles(...REVIEW_ROLES)
    @RequirePermissions(PERMISSIONS.INSTRUCTORS_REVIEW)
    @Delete('suggestions/:id')
    deleteSuggestion(@Param('id') id: string) {
        return this.service.deleteSuggestion(id);
    }
}