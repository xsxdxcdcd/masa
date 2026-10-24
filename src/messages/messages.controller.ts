import { Controller, Post, Body, Get, Query, Patch, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Messages (المراسلة)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    @ApiOperation({ summary: 'Send a message to a user (optionally scoped to a course)' })
    @Post()
    send(
        @Body('recipientId') recipientId: string,
        @Body('courseId') courseId: string | undefined,
        @Body('content') content: string,
        @Request() req: any,
    ) {
        if (!recipientId || !content) {
            throw new BadRequestException('recipientId and content are required');
        }
        return this.messagesService.send(req.user, { recipientId, courseId, content });
    }

    @ApiOperation({ summary: 'My conversations (with last message + unread count)' })
    @Get('conversations')
    conversations(@Request() req: any) {
        return this.messagesService.getConversations(req.user.userId);
    }

    @ApiOperation({ summary: 'Message thread with another user' })
    @Get('thread')
    thread(@Query('with') otherId: string, @Query('courseId') courseId: string | undefined, @Request() req: any) {
        return this.messagesService.getThread(req.user.userId, otherId, courseId);
    }

    @ApiOperation({ summary: 'Mark a conversation as read' })
    @Patch('read')
    markRead(@Query('with') otherId: string, @Query('courseId') courseId: string | undefined, @Request() req: any) {
        return this.messagesService.markRead(req.user.userId, otherId, courseId);
    }

    @ApiOperation({ summary: 'Total unread message count for the current user' })
    @Get('unread-count')
    unreadCount(@Request() req: any) {
        return this.messagesService.getUnreadCount(req.user.userId);
    }

    @ApiOperation({ summary: 'Platform support admins' })
    @Get('support-admins')
    supportAdmins() {
        return this.messagesService.getSupportAdmins();
    }

    @ApiOperation({ summary: 'Who can I message (contacts grouped by kind)' })
    @Get('contacts')
    contacts(@Request() req: any) {
        return this.messagesService.getContacts(req.user);
    }
}
