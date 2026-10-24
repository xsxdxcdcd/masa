import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CurrenciesService } from './currencies.service';
import { WishlistService } from './wishlist.service';
import { ReferralsService } from './referrals.service';
import { CommerceController } from './commerce.controller';
import { WishlistController } from './wishlist.controller';
import { ReferralsController } from './referrals.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [NotificationsModule, ChatModule, FinanceModule],
  controllers: [CommerceController, WishlistController, ReferralsController],
  providers: [PaymentsService, CurrenciesService, WishlistService, ReferralsService],
  exports: [PaymentsService, CurrenciesService, ReferralsService],
})
export class CommerceModule {}
