import { Controller, Get, Post, Delete, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Wishlist (قائمة الرغبات)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private wishlist: WishlistService) {}

  @Get()
  list(@Request() req: any) {
    return this.wishlist.list(req.user.userId);
  }

  @Post('toggle/:courseId')
  toggle(@Param('courseId') courseId: string, @Request() req: any) {
    return this.wishlist.toggle(req.user.userId, courseId);
  }

  @Get('status/:courseId')
  status(@Param('courseId') courseId: string, @Request() req: any) {
    return this.wishlist.status(req.user.userId, courseId);
  }

  @Delete(':courseId')
  remove(@Param('courseId') courseId: string, @Request() req: any) {
    return this.wishlist.remove(req.user.userId, courseId);
  }
}