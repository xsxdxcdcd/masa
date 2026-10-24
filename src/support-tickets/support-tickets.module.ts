import { Module } from '@nestjs/common';
import { SupportTicketsService } from './support-tickets.service';
import { SupportTicketsController } from './support-tickets.controller';
import { AdminSupportTicketsController } from './admin-support-tickets.controller';

@Module({
    controllers: [SupportTicketsController, AdminSupportTicketsController],
    providers: [SupportTicketsService],
})
export class SupportTicketsModule { }