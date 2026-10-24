import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.COURSE_MANAGER, Role.INSTRUCTOR];

@ApiTags('Calendar (التقويم الأكاديمي)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('calendar')
export class CalendarController {
    constructor(private readonly svc: CalendarService) {}

    @ApiOperation({ summary: 'Create calendar event for an opening' })
    @Roles(...STAFF)
    @RequirePermissions(PERMISSIONS.OPENINGS_WRITE)
    @Post('opening/:openingId')
    create(@Param('openingId') openingId: string, @Body() dto: any, @Request() req: any) {
        return this.svc.createEvent(openingId, dto, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'List events for an opening' })
    @Get('opening/:openingId')
    listForOpening(@Param('openingId') openingId: string) {
        return this.svc.listEventsForOpening(openingId);
    }

    @ApiOperation({ summary: 'List all events for current student' })
    @Roles(Role.STUDENT)
    @Get('my')
    listMy(@Request() req: any) {
        return this.svc.listMyEvents(req.user.userId);
    }

    @ApiOperation({ summary: 'Delete calendar event' })
    @Roles(...STAFF)
    @RequirePermissions(PERMISSIONS.OPENINGS_WRITE)
    @Delete(':id')
    remove(@Param('id') id: string, @Request() req: any) {
        return this.svc.deleteEvent(id, req.user.userId, req.user.role);
    }
}
