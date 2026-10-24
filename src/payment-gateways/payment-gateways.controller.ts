import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentGatewaysService } from './payment-gateways.service';

@ApiTags('Payment Gateways')
@Controller('payment-gateways')
export class PaymentGatewaysController {
    constructor(private readonly paymentGatewaysService: PaymentGatewaysService) { }

    @ApiOperation({ summary: 'Public list of active payment methods (with how-to guides)' })
    @Get()
    async getActiveGateways() {
        return this.paymentGatewaysService.getActiveGateways();
    }
}
