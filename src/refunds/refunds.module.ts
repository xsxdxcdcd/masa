import { Module } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommerceModule } from '../commerce/commerce.module';

@Module({
    imports: [NotificationsModule, CommerceModule],
    controllers: [RefundsController],
    providers: [RefundsService],
})
export class RefundsModule {}
