import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
    imports: [NotificationsModule, ChatModule, FinanceModule],
    controllers: [EnrollmentsController],
    providers: [EnrollmentsService],
})
export class EnrollmentsModule { }
