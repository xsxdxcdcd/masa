import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Ratings (تقييم المدربين)')
@ApiBearerAuth('JWT-auth')
@Controller('ratings')
export class RatingsController {
    constructor(private readonly svc: RatingsService) {}

    @ApiOperation({ summary: 'Rate instructor for a course (1-5 stars)' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.STUDENT)
    @Post('course/:courseId')
    rate(@Param('courseId') courseId: string, @Body() dto: any, @Request() req: any) {
        return this.svc.rateInstructor(courseId, dto, req.user.userId);
    }

    @ApiOperation({ summary: 'Get instructor ratings (public)' })
    @Get('instructor/:instructorId')
    getInstructor(@Param('instructorId') instructorId: string) {
        return this.svc.getInstructorRatings(instructorId);
    }

    @ApiOperation({ summary: 'Get course ratings (public)' })
    @Get('course/:courseId')
    getCourse(@Param('courseId') courseId: string) {
        return this.svc.getCourseRatings(courseId);
    }

    @ApiOperation({ summary: 'Delete own rating' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.STUDENT)
    @Delete(':id')
    remove(@Param('id') id: string, @Request() req: any) {
        return this.svc.deleteRating(id, req.user.userId);
    }
}
