import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { ChatService } from '../chat/chat.service';
import { FinanceService } from '../finance/finance.service';
import { Role, PaymentStatus, EnrollmentStatus } from '@prisma/client';
import { claimSeat, releaseSeat, assertOpeningEligible, CapacityConflictException } from '../common/opening-seats';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { getFrontendUrl } from '../common/frontend-url';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private email: EmailService,
    private audit: AuditService,
    private chatService: ChatService,
    private finance: FinanceService,
  ) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2026-07-29.dahlia' });
    }
  }

  private appUrl() {
    return getFrontendUrl();
  }

  private async resolveOpening(openingId: string) {
    const opening = await this.prisma.courseOpening.findUnique({
      where: { id: openingId },
      include: { course: true, instructor: { select: { id: true, email: true } } },
    });
    if (!opening) throw new NotFoundException('Opening not found');
    return opening;
  }

  /**
   * Approve the enrollment for a successfully paid opening — creating it when
   * needed — and atomically claim a seat for it. Leaves already-held seats
   * untouched (PENDING/RESERVED/APPROVED already occupy their seat).
   */
  private async approveEnrollmentTx(tx: Prisma.TransactionClient, studentId: string, openingId: string, courseId: string) {
    const existing = await tx.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    // RESERVED / PENDING / APPROVED already hold a seat; REJECTED / REVOKED
    // gave theirs back, so (re)claim before flipping to APPROVED.
    const holdsSeat = existing
      && (existing.status === EnrollmentStatus.PENDING
        || existing.status === EnrollmentStatus.RESERVED
        || existing.status === EnrollmentStatus.APPROVED);
    if (!holdsSeat) {
      await claimSeat(tx, openingId);
    }
    if (existing) {
      return tx.enrollment.update({
        where: { id: existing.id },
        data: { openingId, status: EnrollmentStatus.APPROVED },
      });
    }
    return tx.enrollment.create({
      data: { studentId, courseId, openingId, status: EnrollmentStatus.APPROVED },
    });
  }

  async checkout(studentId: string, openingId: string, opts: { provider?: string; couponCode?: string }) {
    const opening = await this.resolveOpening(openingId);
    // Reject closed / unpublished / expired / full openings BEFORE taking money.
    // The authoritative atomic seat reservation happens on payment settlement.
    assertOpeningEligible(opening, { requirePublished: true, enforceDeadline: true });

    const price = Number(opening.price);

    let amount = price;
    let couponCode: string | undefined = opts.couponCode?.trim().toUpperCase() || undefined;
    let couponId: string | undefined;
    if (couponCode) {
      const result = await this.finance.validateCoupon(couponCode, opening.courseId, price);
      amount = result.finalAmount ?? price;
      couponId = result.id;
    }

    const provider = (opts.provider || 'MANUAL').toUpperCase();

    const payment = await this.prisma.payment.create({
      data: {
        studentId,
        openingId,
        amount,
        currency: opening.currency,
        provider,
        couponCode,
        couponId,
        description: `Enrollment in ${opening.course.titleEn}`,
      },
    });

    if (provider === 'STRIPE') {
      if (!this.stripe) throw new BadRequestException('Online payments are not configured. Please use the manual payment method.');
      const intent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: opening.currency.toLowerCase(),
        metadata: { paymentId: payment.id, openingId, studentId },
        description: payment.description ?? undefined,
        automatic_payment_methods: { enabled: true },
      });
      await this.prisma.payment.update({ where: { id: payment.id }, data: { providerRef: intent.id } });
      return { id: payment.id, provider, clientSecret: intent.client_secret, redirectUrl: null, amount, currency: opening.currency, couponCode, paymentIntentId: intent.id };
    }

    const gateways = await this.prisma.paymentGateway.findMany({ where: { isActive: true } });
    return { id: payment.id, provider: 'MANUAL', clientSecret: null, redirectUrl: null, amount, currency: opening.currency, couponCode, instructions: gateways[0]?.instructions ?? '' };
  }

  async webhookStripe(payload: Buffer, signature: string) {
    if (!this.stripe) throw new BadRequestException('Stripe is not configured');
    let event: Stripe.Event;
    try {
      const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
      event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
        // Log detailed error server-side only; return generic message to client
        console.error('[Stripe Webhook] Signature verification failed:', (err as Error).message);
        throw new BadRequestException('Webhook signature verification failed');
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = intent.metadata?.paymentId;
      if (paymentId) {
        const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { student: { select: { id: true, email: true } }, opening: true } });
        if (payment) {
          // Idempotency: a duplicate delivery of the same Stripe event must not
          // re-run the settlement (the DB unique PK is the backstop; this fast
          // path short-circuits the retries Stripe sends for 5xx responses).
          const alreadyProcessed = await this.prisma.webhookEvent.findUnique({ where: { id: event.id } });
          if (alreadyProcessed) {
            return { received: true, idempotent: true };
          }
          // Identity check: the settled PaymentIntent must be the one WE created
          // for this payment (providerRef), with a matching charge amount and
          // currency. A mismatch means we should NOT honour the enrollment.
          if (payment.provider && payment.providerRef && payment.providerRef !== intent.id) {
            console.error(`[Stripe Webhook] PaymentIntent mismatch: payment ${paymentId} has providerRef ${payment.providerRef} but event carries ${intent.id}. Refusing to process.`);
            return { received: true, ignored: 'providerRef_mismatch' };
          }
          const expectedCents = Math.round(Number(payment.amount) * 100);
          if (intent.amount !== expectedCents || intent.currency.toLowerCase() !== payment.currency.toLowerCase()) {
            console.error(`[Stripe Webhook] Amount/currency mismatch: payment ${paymentId} expects ${expectedCents}/${payment.currency} but event carries ${intent.amount}/${intent.currency}. Refusing to process.`);
            return { received: true, ignored: 'amount_currency_mismatch' };
          }

          try {
            // One atomic transaction: idempotency record + seat claim + payment
            // PAID + enrollment APPROVED + coupon usage. If ANY step fails the
            // whole thing rolls back, so a retried event replays cleanly and a
            // payment can never end up "paid" without an enrollment.
            await this.prisma.$transaction(async (tx) => {
              await tx.webhookEvent.create({
                data: { id: event.id, type: event.type, paymentId },
              });
              // Enrollment re-approval may (re)claim a seat; this can throw
              // CapacityConflictException when the opening is full.
              const enrollment = await this.approveEnrollmentTx(tx, payment.studentId, payment.openingId, payment.opening.courseId);
              await tx.payment.update({
                where: { id: paymentId },
                data: { status: PaymentStatus.PAID, paidAt: new Date(), enrollmentId: enrollment.id },
              });
              if (payment.couponId || payment.couponCode) {
                const originalPrice = Number(payment.opening.price);
                await this.finance.redeemCoupon(tx, {
                  couponId: payment.couponId,
                  couponCode: payment.couponCode,
                  studentId: payment.studentId,
                  courseId: payment.opening.courseId,
                  paymentId,
                  amountOff: Math.max(0, originalPrice - Number(payment.amount)),
                });
              }
            });

            // The batch room is created and populated here rather than waiting
            // for the student's first GET /chat/rooms, so an approved student
            // finds their cohort waiting instead of an empty panel. Same
            // best-effort contract as the manual review path: a chat failure
            // must not fail a settled payment.
            try {
              const room = await this.chatService.getOrCreateRoomForOpening(payment.openingId);
              await this.chatService.syncRoomMembers(room.id);
            } catch (chatErr) {
              console.error('[Stripe Webhook] Batch chat sync failed:', (chatErr as Error).message);
            }
          } catch (err) {
            // The seat claim inside the transaction rolled everything back;
            // the student paid but there is no seat. Auto-refund + notify so we
            // never hold money without an enrollment.
            if (err instanceof CapacityConflictException) {
              console.error(`[Stripe Webhook] Auto-refunding ${paymentId}: opening ${payment.openingId} is at capacity.`);
              if (payment.providerRef) {
                try {
                  await this.stripe.refunds.create({ payment_intent: payment.providerRef });
                } catch (refundErr) {
                  console.error('[Stripe Webhook] Auto-refund failed:', (refundErr as Error).message);
                }
              }
              await this.prisma.$transaction(async (tx) => {
                await tx.webhookEvent.create({ data: { id: event.id, type: event.type, paymentId } }).catch(() => {});
                await tx.payment.update({
                  where: { id: paymentId },
                  data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() },
                });
              });
              await this.notifications.notify({
                userId: payment.studentId,
                type: 'payment.refunded',
                titleAr: 'تم استرداد المبلغ تلقائياً',
                titleEn: 'Payment automatically refunded',
                bodyAr: 'وصلت دفعتك بعد امتلاء مقاعد هذه الدورة، لذا تم استرداد المبلغ تلقائياً.',
                bodyEn: 'Your payment arrived after this course filled up, so it was automatically refunded.',
                data: { paymentId, openingId: payment.openingId },
                email: { to: payment.student.email },
              }).catch(() => {});
              return { received: true, action: 'auto_refunded_capacity' };
            }
            throw err;
          }
          await this.notifications.notify({
            userId: payment.studentId,
            type: 'payment.confirmed',
            titleAr: 'تم تأكيد الدفع',
            titleEn: 'Payment confirmed',
            bodyAr: 'تم تأكيد دفعتك بنجاح وتم تفعيل تسجيلك في الدورة.',
            bodyEn: 'Your payment was confirmed and your enrollment is now active.',
            data: { paymentId, openingId: payment.openingId },
            email: {
              to: payment.student.email,
            },
          }).catch(() => {});
        } else {
          // Payment record unknown to us (deleted / test data): record the event
          // as processed so Stripe doesn't keep retrying it.
          await this.prisma.webhookEvent.create({ data: { id: event.id, type: event.type, paymentId } }).catch(() => {});
        }
      }
    }
    return { received: true };
  }

  async listMy(studentId: string) {
    return this.prisma.payment.findMany({
      where: { studentId },
      include: { opening: { select: { id: true, nameAr: true, nameEn: true, status: true, course: { select: { id: true, titleAr: true, titleEn: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll() {
    return this.prisma.payment.findMany({
      include: {
        student: { select: { id: true, email: true } },
        opening: { select: { id: true, nameAr: true, nameEn: true, course: { select: { id: true, titleAr: true, titleEn: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async refund(paymentId: string, actorId: string, role: Role, reason?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (role !== Role.ADMIN && role !== Role.FINANCE) throw new ForbiddenException('Only finance staff can refund payments');
    if (payment.status !== PaymentStatus.PAID) throw new BadRequestException('Only paid payments can be refunded');

    if (payment.provider === 'STRIPE' && payment.providerRef && this.stripe) {
      const refundReason = reason === 'duplicate' || reason === 'fraudulent' || reason === 'requested_by_customer' ? reason : undefined;
      await this.stripe.refunds.create({ payment_intent: payment.providerRef, ...(refundReason ? { reason: refundReason } : {}) });
    }

    // Refund disables the enrollment in the same transaction: the student no
    // longer has an active seat (enrollment -> REVOKED), so they can't keep
    // course access after the money has been returned.
    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() },
      });
      if (payment.enrollmentId) {
        await tx.enrollment.update({
          where: { id: payment.enrollmentId },
          data: { status: EnrollmentStatus.REVOKED },
        });
        // The student gives up their seat when the money is returned, so the
        // opening can be re-filled (atomic counter keeps parity with capacity).
        await releaseSeat(tx, payment.openingId);
      }
      return p;
    });

    await this.audit.logAction(`Finance refunded Payment ${paymentId}${reason ? ` (${reason})` : ''}`, undefined, actorId);
    await this.notifications.notify({
      userId: payment.studentId,
      type: 'payment.refunded',
      titleAr: 'تم استرداد المبلغ',
      titleEn: 'Payment refunded',
      bodyAr: reason ?? 'تم استرداد مبلغ دفعتك وتم إلغاء تسجيلك في الدورة.',
      bodyEn: reason ?? 'Your payment has been refunded and your enrollment was cancelled.',
      data: { paymentId },
    }).catch(() => {});
    // REVOKED members must leave the batch chat room (membership syncs only APPROVED/RESERVED).
    if (payment.openingId) {
      try {
        const room = await this.chatService.getOrCreateRoomForOpening(payment.openingId);
        await this.chatService.syncRoomMembers(room.id);
      } catch { /* don't fail refund if chat sync fails */ }
    }
    return { ok: true, status: updated.status, enrollmentStatus: payment.enrollmentId ? EnrollmentStatus.REVOKED : null };
  }

  async cancel(paymentId: string, actorId: string, role: Role) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');

    const allowed = role === Role.ADMIN || role === Role.FINANCE || payment.studentId === actorId;
    if (!allowed) throw new ForbiddenException('You can only cancel your own pending payments');

    // Only a pending manual payment can be cancelled before review/approval;
    // cancelling an already-decided payment would produce an invalid transition.
    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException(`Only pending payments can be cancelled (current status: ${payment.status})`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.CANCELLED },
      });
      // If the linked enrollment is still awaiting review for this payment,
      // release it back to RESERVED so the student can re-apply later.
      if (payment.enrollmentId) {
        const enrollment = await tx.enrollment.findUnique({ where: { id: payment.enrollmentId } });
        if (enrollment && (enrollment.status === EnrollmentStatus.PENDING || enrollment.status === EnrollmentStatus.RESERVED)) {
          await tx.enrollment.update({
            where: { id: payment.enrollmentId },
            data: { status: EnrollmentStatus.RESERVED },
          });
        }
      }
      return p;
    });

    await this.audit.logAction(`Payment ${paymentId} cancelled`, undefined, actorId);
    return { ok: true, status: updated.status };
  }
}
