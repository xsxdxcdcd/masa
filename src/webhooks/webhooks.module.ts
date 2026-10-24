import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [CommerceModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}