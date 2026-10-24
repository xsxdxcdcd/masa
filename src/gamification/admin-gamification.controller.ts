import { Controller, Post, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';

@ApiTags('Gamification (نظام النقاط)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('api/admin/gamification')
export class AdminGamificationController {
    constructor(private readonly svc: GamificationService) {}

    @ApiOperation({ summary: 'Add points (internal)' })
    @Roles(Role.ADMIN)
    @RequirePermissions(PERMISSIONS.GAMIFICATION_MANAGE)
    @Post('add-points')
    addPoints(@Request() req: any, @Query('userId') userId: string, @Query('action') action: string) {
        return this.svc.addPoints(userId || req.user.userId, action || 'daily_login');
    }
}
