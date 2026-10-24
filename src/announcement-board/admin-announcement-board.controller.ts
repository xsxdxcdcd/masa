import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';
import { AnnouncementBoardService } from './announcement-board.service';
import { CreateAnnouncementBoardDto } from './dto/create-announcement-board.dto';
import { UpdateAnnouncementBoardDto } from './dto/update-announcement-board.dto';

@ApiTags('Announcement Board')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('api/admin/announcement-board')
export class AdminAnnouncementBoardController {
    constructor(private readonly service: AnnouncementBoardService) {}

    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.NEWS_READ)
    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.NEWS_READ)
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.NEWS_WRITE)
    @Post()
    create(@Body() dto: CreateAnnouncementBoardDto, @Request() req: any) {
        return this.service.create({ ...dto, authorId: req.user.userId });
    }

    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.NEWS_WRITE)
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateAnnouncementBoardDto) {
        return this.service.update(id, dto);
    }

    @Roles(Role.ADMIN, Role.COURSE_MANAGER)
    @RequirePermissions(PERMISSIONS.NEWS_WRITE)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.service.remove(id);
    }
}
