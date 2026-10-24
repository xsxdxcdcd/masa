import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';

const STAFF_ROLES = [Role.ADMIN, Role.COURSE_MANAGER, Role.INSTRUCTOR];

@ApiTags('Announcements (إعلانات الدورة)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('announcements')
export class AnnouncementsController {
    constructor(private readonly announcementsService: AnnouncementsService) {}

    @ApiOperation({ summary: 'List announcements for an opening (staff see all; students see published only)' })
    @Get('opening/:openingId')
    list(@Param('openingId') openingId: string, @Request() req: any) {
        return this.announcementsService.listAnnouncements(openingId, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Create an announcement for an opening (instructor of the opening or staff)' })
    @ApiResponse({ status: 201, description: 'Announcement created.' })
    @Roles(...STAFF_ROLES)
    @RequirePermissions(PERMISSIONS.CONTENT_WRITE)
    @Post('opening/:openingId')
    create(
        @Param('openingId') openingId: string,
        @Body('titleAr') titleAr: string,
        @Body('titleEn') titleEn: string,
        @Body('contentAr') contentAr: string,
        @Body('contentEn') contentEn: string,
        @Body('isPublished') isPublished: boolean | undefined,
        @Request() req: any,
    ) {
        return this.announcementsService.createAnnouncement(openingId, { titleAr, titleEn, contentAr, contentEn, isPublished }, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Get a single announcement' })
    @Get(':id')
    getOne(@Param('id') id: string, @Request() req: any) {
        return this.announcementsService.getAnnouncement(id, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Update an announcement' })
    @Roles(...STAFF_ROLES)
    @RequirePermissions(PERMISSIONS.CONTENT_WRITE)
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body('titleAr') titleAr: string | undefined,
        @Body('titleEn') titleEn: string | undefined,
        @Body('contentAr') contentAr: string | undefined,
        @Body('contentEn') contentEn: string | undefined,
        @Body('isPublished') isPublished: boolean | undefined,
        @Request() req: any,
    ) {
        return this.announcementsService.updateAnnouncement(id, { titleAr, titleEn, contentAr, contentEn, isPublished }, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Delete an announcement' })
    @Roles(...STAFF_ROLES)
    @RequirePermissions(PERMISSIONS.CONTENT_DELETE)
    @Delete(':id')
    remove(@Param('id') id: string, @Request() req: any) {
        return this.announcementsService.deleteAnnouncement(id, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Toggle publish status of an announcement' })
    @Roles(...STAFF_ROLES)
    @RequirePermissions(PERMISSIONS.CONTENT_WRITE)
    @Patch(':id/toggle-publish')
    togglePublish(@Param('id') id: string, @Request() req: any) {
        return this.announcementsService.togglePublish(id, req.user.userId, req.user.role);
    }
}
