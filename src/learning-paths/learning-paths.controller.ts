import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LearningPathsService } from './learning-paths.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';

const STAFF = [Role.ADMIN, Role.COURSE_MANAGER];

@ApiTags('Learning Paths (مسارات التعلم)')
@ApiBearerAuth('JWT-auth')
@Controller('learning-paths')
export class LearningPathsController {
    constructor(private readonly svc: LearningPathsService) {}

    @ApiOperation({ summary: 'Create a learning path' })
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(...STAFF)
    @RequirePermissions(PERMISSIONS.PATHS_WRITE)
    @Post()
    create(@Body() dto: any, @Request() req: any) {
        return this.svc.createPath(dto, req.user.userId);
    }

    @ApiOperation({ summary: 'List learning paths' })
    @Get()
    list() {
        return this.svc.listPaths(true);
    }

    @ApiOperation({ summary: 'Get learning path details' })
    @Get(':id')
    getOne(@Param('id') id: string) {
        return this.svc.getPath(id);
    }

    @ApiOperation({ summary: 'Update learning path' })
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(...STAFF)
    @RequirePermissions(PERMISSIONS.PATHS_WRITE)
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
        return this.svc.updatePath(id, dto, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Delete learning path' })
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(...STAFF)
    @RequirePermissions(PERMISSIONS.PATHS_WRITE)
    @Delete(':id')
    remove(@Param('id') id: string, @Request() req: any) {
        return this.svc.deletePath(id, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Enroll in a learning path' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.STUDENT)
    @Post(':id/enroll')
    enroll(@Param('id') id: string, @Request() req: any) {
        return this.svc.enrollPath(id, req.user.userId);
    }
}
