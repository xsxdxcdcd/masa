import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReferralsService {
  constructor(private prisma: PrismaService) {}

  private alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  private async generateCode(userId: string): Promise<string> {
    let code = '';
    do {
      code = Array.from({ length: 8 }, () => this.alphabet[Math.floor(Math.random() * this.alphabet.length)]).join('');
    } while (await this.prisma.referral.findUnique({ where: { code } }));
    return code;
  }

  async myCode(userId: string) {
    let referral = await this.prisma.referral.findFirst({ where: { referrerId: userId } });
    if (!referral) {
      const code = await this.generateCode(userId);
      referral = await this.prisma.referral.create({ data: { referrerId: userId, code } });
    }
    return referral;
  }

  async myList(userId: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      include: { rewardCoupon: true },
      orderBy: { createdAt: 'desc' },
    });
    const referredUsers = await this.prisma.user.findMany({
      where: { id: { in: referrals.map((r) => r.referredUserId).filter(Boolean) as string[] } },
      select: { id: true, email: true },
    });
    const byId = new Map(referredUsers.map((u) => [u.id, u]));
    return referrals.map((r) => ({ ...r, referredUser: r.referredUserId ? byId.get(r.referredUserId) ?? null : null }));
  }

  async attachReferral(code: string, referredEmail: string, referredUserId: string) {
    const referral = await this.prisma.referral.findUnique({ where: { code } });
    if (!referral) return null;
    if (referral.referredUserId) return referral;
    return this.prisma.referral.update({
      where: { id: referral.id },
      data: { referredEmail, referredUserId, status: 'SIGNED_UP' },
    });
  }

  async claimReward(referralId: string, rewardCode: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: rewardCode } });
    if (!coupon) throw new NotFoundException('Referral reward coupon not found');
    await this.prisma.coupon.update({ where: { id: coupon.id }, data: { active: true } });
    return this.prisma.referral.update({ where: { id: referralId }, data: { rewardCouponId: coupon.id, status: 'REWARDED' } });
  }
}