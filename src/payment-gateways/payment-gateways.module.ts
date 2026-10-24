import { Module } from '@nestjs/common';
import { PaymentGatewaysController } from './payment-gateways.controller';
import { AdminPaymentGatewaysController } from './admin-payment-gateways.controller';
import { PaymentGatewaysService } from './payment-gateways.service';

@Module({
  controllers: [PaymentGatewaysController, AdminPaymentGatewaysController],
  providers: [PaymentGatewaysService]
})
export class PaymentGatewaysModule {}
