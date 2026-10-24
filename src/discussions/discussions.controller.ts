import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DiscussionsService } from './discussions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Discussions (منتدى الدورات)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('discussions')
export class DiscussionsController {
    constructor(private readonly svc: DiscussionsService) {}

    @ApiOperation({ summary: 'Create a discussion post for a module' })
    @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.ADMIN, Role.COURSE_MANAGER)
    @Post('module/:moduleId/posts')
    createPost(@Param('moduleId') moduleId: string, @Body() dto: any, @Request() req: any) {
        return this.svc.createPost(moduleId, dto, req.user.userId);
    }

    @ApiOperation({ summary: 'List discussion posts for a module' })
    @Get('module/:moduleId/posts')
    listPosts(@Param('moduleId') moduleId: string) {
        return this.svc.listPosts(moduleId);
    }

    @ApiOperation({ summary: 'Get a discussion post with replies' })
    @Get('posts/:postId')
    getPost(@Param('postId') postId: string) {
        return this.svc.getPost(postId);
    }

    @ApiOperation({ summary: 'Reply to a discussion post' })
    @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.ADMIN, Role.COURSE_MANAGER)
    @Post('posts/:postId/replies')
    createReply(@Param('postId') postId: string, @Body() dto: any, @Request() req: any) {
        return this.svc.createReply(postId, dto, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Toggle resolved status of a post' })
    @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.ADMIN, Role.COURSE_MANAGER)
    @Patch('posts/:postId/resolve')
    toggleResolved(@Param('postId') postId: string, @Request() req: any) {
        return this.svc.toggleResolved(postId, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Delete a discussion post' })
    @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.ADMIN, Role.COURSE_MANAGER)
    @Delete('posts/:postId')
    deletePost(@Param('postId') postId: string, @Request() req: any) {
        return this.svc.deletePost(postId, req.user.userId, req.user.role);
    }

    @ApiOperation({ summary: 'Delete a discussion reply' })
    @Roles(Role.STUDENT, Role.INSTRUCTOR, Role.ADMIN, Role.COURSE_MANAGER)
    @Delete('replies/:replyId')
    deleteReply(@Param('replyId') replyId: string, @Request() req: any) {
        return this.svc.deleteReply(replyId, req.user.userId, req.user.role);
    }
}
