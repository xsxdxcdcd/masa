import { Controller, Get, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('Courses Management')
@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) { }

    @ApiOperation({ summary: 'List all published courses' })
    @ApiResponse({ status: 200, description: 'List of courses returned.' })
    @UseGuards(OptionalJwtAuthGuard)
    @Get()
    findAll(@Query('includeUnpublished') includeUnpublished?: string, @Request() req?: any) {
        // Only allow includeUnpublished for authenticated staff users
        const allowUnpublished = includeUnpublished === 'true' && req?.user?.role && ['ADMIN', 'COURSE_MANAGER'].includes(req.user.role);
        return this.coursesService.findAll(allowUnpublished, req?.user);
    }

    @ApiOperation({ summary: 'List openings (batches) of a course' })
    @ApiResponse({ status: 200, description: 'Openings returned.' })
    @UseGuards(OptionalJwtAuthGuard)
    @Get(':id/openings')
    listOpenings(@Param('id') id: string, @Query('includeUnpublished') includeUnpublished?: string, @Request() req?: any) {
        const allowUnpublished = includeUnpublished === 'true' && req?.user?.role && ['ADMIN', 'COURSE_MANAGER'].includes(req.user.role);
        return this.coursesService.listOpenings(id, allowUnpublished, req?.user);
    }

    @ApiOperation({ summary: 'Get specific course details' })
    @ApiResponse({ status: 200, description: 'Detailed course structure returned.' })
    @ApiResponse({ status: 404, description: 'Course not found.' })
    @UseGuards(OptionalJwtAuthGuard)
    @Get(':id')
    findOne(@Param('id') id: string, @Query('includeUnpublished') includeUnpublished?: string, @Request() req?: any) {
        const allowUnpublished = includeUnpublished === 'true' && req?.user?.role && ['ADMIN', 'COURSE_MANAGER'].includes(req.user.role);
        return this.coursesService.findOne(id, allowUnpublished, req?.user);
    }
}
