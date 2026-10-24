import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportTicketsService } from './support-tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';

@ApiTags('Support Tickets (الشكاوى والدعم)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('api/admin/support-tickets')
export class AdminSupportTicketsController {
    constructor(private readonly supportTicketsService: SupportTicketsService) { }

    @ApiOperation({ summary: 'All tickets (staff)' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.SUPPORT_READ)
    @Get()
    getAll() {
        return this.supportTicketsService.getAll();
    }

    @ApiOperation({ summary: 'Update a ticket (status / reply)' })
    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.SUPPORT_WRITE)
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body('status') status: string | undefined,
        @Body('adminNotes') adminNotes: string | undefined,
        @Request() req: any,
    ) {
        return this.supportTicketsService.update(id, { status, adminNotes }, req.user.userId);
    }
}
