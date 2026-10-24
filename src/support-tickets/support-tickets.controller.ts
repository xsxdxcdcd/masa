import { Controller, Post, Body, Get, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportTicketsService } from './support-tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Support Tickets (الشكاوى والدعم)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support-tickets')
export class SupportTicketsController {
    constructor(private readonly supportTicketsService: SupportTicketsService) { }

    @ApiOperation({ summary: 'Submit a support ticket / complaint' })
    @Post()
    create(
        @Body('subject') subject: string,
        @Body('message') message: string,
        @Request() req: any,
    ) {
        if (!subject || !message) {
            throw new BadRequestException('subject and message are required');
        }
        return this.supportTicketsService.create(req.user.userId, { subject, message });
    }

    @ApiOperation({ summary: 'My tickets' })
    @Get('my')
    getMy(@Request() req: any) {
        return this.supportTicketsService.getMy(req.user.userId);
    }
}
