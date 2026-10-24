import { Module } from '@nestjs/common';
import { DiscussionsService } from './discussions.service';
import { DiscussionsController } from './discussions.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
    imports: [NotificationsModule, GamificationModule],
    controllers: [DiscussionsController],
    providers: [DiscussionsService],
    exports: [DiscussionsService],
})
export class DiscussionsModule {}