import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';

@ApiTags('LMS: Quizzes')
@ApiBearerAuth('JWT-auth')
@Controller('quizzes')
export class QuizzesController {
  constructor(private quizzes: QuizzesService) {}

  @ApiOperation({ summary: 'Create a quiz (Admins/Course Managers)' })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @RequirePermissions(PERMISSIONS.COURSES_WRITE)
  @Post()
  create(@Body() dto: any) {
    if (!dto?.courseId || !dto?.titleAr || !dto?.titleEn) throw new BadRequestException('courseId, titleAr and titleEn are required');
    return this.quizzes.create(dto);
  }

  @ApiOperation({ summary: 'Update a quiz (Admins/Course Managers)' })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @RequirePermissions(PERMISSIONS.COURSES_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.quizzes.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a quiz (Admins/Course Managers)' })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @RequirePermissions(PERMISSIONS.COURSES_DELETE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quizzes.remove(id);
  }

  @ApiOperation({ summary: 'List quizzes for a course (with answers when includeUnpublished=true)' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get('course/:courseId')
  listByCourse(@Param('courseId') courseId: string, @Query('includeUnpublished') includeUnpublished?: string, @Request() req?: any) {
    // Only allow includeUnpublished for authenticated staff users
    const allowUnpublished = includeUnpublished === 'true' && req?.user?.role && ['ADMIN', 'COURSE_MANAGER'].includes(req.user.role);
    return this.quizzes.listByCourse(courseId, allowUnpublished);
  }

  @ApiOperation({ summary: 'Get a published quiz (answers stripped)' })
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.quizzes.getPublic(id);
  }

  @ApiOperation({ summary: 'My best attempt for a quiz' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Get(':id/my-attempt')
  myAttempt(@Param('id') id: string, @Request() req: any) {
    return this.quizzes.myAttempt(id, req.user.userId);
  }

  @ApiOperation({ summary: 'Submit an attempt: { enrollmentId, quizId?, answers: [{questionId, selected: number[]}] }' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Post(':id/attempt')
  attempt(@Param('id') id: string, @Body('enrollmentId') enrollmentId: string, @Body('answers') answers: any, @Request() req: any) {
    if (!enrollmentId || !Array.isArray(answers)) throw new BadRequestException('enrollmentId and answers are required');
    return this.quizzes.attempt(id, enrollmentId, answers, req.user.userId);
  }
}