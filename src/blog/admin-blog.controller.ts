import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';

@ApiTags('Blog')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('api/admin/blog')
export class AdminBlogController {
  constructor(private blog: BlogService) {}

  @ApiOperation({ summary: 'Admin list of all posts (including drafts)' })
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Get()
  listAll() {
    return this.blog.listAllAdmin();
  }

  @ApiOperation({ summary: 'Create a post (Admins/Course Managers)' })
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Post()
  create(@Body() dto: any, @Request() req: any) {
    return this.blog.create(dto, req.user.userId);
  }

  @ApiOperation({ summary: 'Update a post (Admins/Course Managers)' })
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.blog.update(id, dto);
  }

  @ApiOperation({ summary: 'Publish a post' })
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.blog.setPublished(id, true);
  }

  @ApiOperation({ summary: 'Unpublish a post' })
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.blog.setPublished(id, false);
  }

  @ApiOperation({ summary: 'Delete a post (Admins/Course Managers)' })
  @Roles(Role.ADMIN, Role.COURSE_MANAGER)
  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blog.remove(id);
  }
}
