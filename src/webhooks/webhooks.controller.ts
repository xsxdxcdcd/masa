import { Controller, Post, Req, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from '../commerce/payments.service';

// NOTE: This controller intentionally has NO JwtAuthGuard/RolesGuard.
// Stripe signs the raw body with the webhook secret; authentication is the
// "Stripe-Signature" header (verified via constructEvent in PaymentsService),
// NOT a user JWT. Keeping it behind the JWT guard would make the callback
// fail with 401 once the access token expires on a refresh-token cycle.
@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('stripe')
  async stripeWebhook(@Req() req: any, @Headers('stripe-signature') signature?: string) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }
    return this.payments.webhookStripe(req.rawBody ?? Buffer.alloc(0), signature);
  }
}