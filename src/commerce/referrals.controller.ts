import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Referrals (الإحالات)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private referrals: ReferralsService) {}

  @Get('me')
  myCode(@Request() req: any) {
    return this.referrals.myCode(req.user.userId);
  }

  @Get('my-list')
  myList(@Request() req: any) {
    return this.referrals.myList(req.user.userId);
  }
}