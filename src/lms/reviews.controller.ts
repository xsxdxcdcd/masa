import { Controller, Get, Post, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';

@ApiTags('LMS: Course Reviews')
@ApiBearerAuth('JWT-auth')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @ApiOperation({ summary: 'Submit or update my review for a course (enrolled students)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Post()
  create(@Request() req: any, @Body() dto: any) {
    return this.reviews.upsert(req.user.userId, dto);
  }

  @ApiOperation({ summary: 'Public reviews + aggregate for a course' })
  @Get('course/:courseId')
  list(@Param('courseId') courseId: string) {
    return this.reviews.listForCourse(courseId);
  }

  @ApiOperation({ summary: 'Publish / unpublish a review (Admins/Course Managers)' })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @RequirePermissions(PERMISSIONS.CONTENT_WRITE)
  @Patch(':id/moderation')
  moderate(@Param('id') id: string, @Body('isPublished') isPublished: boolean) {
    return this.reviews.setModeration(id, isPublished);
  }
}