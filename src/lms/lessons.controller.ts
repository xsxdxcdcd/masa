import { Controller, Get, Post, Put, Delete, Param, Query, Body, Request, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LessonsService } from './lessons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('LMS: Lessons & Progress')
@ApiBearerAuth('JWT-auth')
@Controller('lms')
export class LessonsController {
  constructor(private lessons: LessonsService) {}

  @ApiOperation({ summary: 'Public syllabus for a course (modules + outcomes + quizzes + live sessions)' })
  @Get('courses/:courseId/syllabus')
  syllabus(@Param('courseId') courseId: string) {
    return this.lessons.syllabus(courseId);
  }

  @ApiOperation({ summary: 'My progress in a course (must be enrolled)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.COURSE_MANAGER, Role.FINANCE, Role.ADMIN)
  @Get('courses/:courseId/my-progress')
  myProgress(@Param('courseId') courseId: string, @Request() req: any) {
    return this.lessons.courseProgress(courseId, req.user.userId);
  }

  @ApiOperation({ summary: 'Mark a module complete' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Post('progress')
  markComplete(@Body('enrollmentId') enrollmentId: string, @Body('moduleId') moduleId: string, @Request() req: any) {
    if (!enrollmentId || !moduleId) throw new BadRequestException('enrollmentId and moduleId are required');
    return this.lessons.markComplete(enrollmentId, moduleId, req.user.userId);
  }

  @ApiOperation({ summary: 'Mark a module incomplete' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Delete('progress/:moduleId')
  markIncomplete(@Param('moduleId') moduleId: string, @Query('enrollmentId') enrollmentId: string, @Request() req: any) {
    if (!enrollmentId) throw new BadRequestException('enrollmentId is required');
    return this.lessons.markIncomplete(enrollmentId, moduleId, req.user.userId);
  }

  @ApiOperation({ summary: 'My private notes per lesson (must be enrolled)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Get('courses/:courseId/my-notes')
  myNotes(@Param('courseId') courseId: string, @Request() req: any) {
    return this.lessons.myNotes(courseId, req.user.userId);
  }

  @ApiOperation({ summary: 'Auto-save my note for a lesson' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @Put('notes/:moduleId')
  saveNote(@Param('moduleId') moduleId: string, @Body('content') content: string, @Request() req: any) {
    if (typeof content !== 'string') throw new BadRequestException('content is required');
    return this.lessons.saveNote(moduleId, content, req.user.userId);
  }
}