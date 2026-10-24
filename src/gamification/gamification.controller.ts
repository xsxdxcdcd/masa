import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Gamification (نظام النقاط)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gamification')
export class GamificationController {
    constructor(private readonly svc: GamificationService) {}

    @ApiOperation({ summary: 'Get current user gamification data' })
    @Get('me')
    getMe(@Request() req: any) {
        return this.svc.getUserGamification(req.user.userId);
    }

    @ApiOperation({ summary: 'Track daily activity' })
    @Post('track')
    track(@Request() req: any) {
        return this.svc.trackActivity(req.user.userId);
    }

    @ApiOperation({ summary: 'Get leaderboard' })
    @Get('leaderboard')
    leaderboard(@Query('limit') limit?: string) {
        return this.svc.getLeaderboard(limit ? parseInt(limit, 10) : 10);
    }

    @ApiOperation({ summary: "Get gamification data for one user (admin, or the user themselves)" })
    @Get(':userId')
    getByUser(@Param('userId') userId: string, @Request() req: any) {
        return this.svc.getUserGamificationForViewer(userId, req.user.userId, req.user.role);
    }
}
