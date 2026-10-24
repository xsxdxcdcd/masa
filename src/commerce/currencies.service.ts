import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_CURRENCIES = [
  { code: 'SAR', symbol: 'ر.س', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', rate: 1, isBase: true },
  { code: 'USD', symbol: '$', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', rate: 3.75, isBase: false },
  { code: 'EUR', symbol: '€', nameAr: 'يورو', nameEn: 'Euro', rate: 4.05, isBase: false },
  { code: 'AED', symbol: 'د.إ', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', rate: 1.02, isBase: false },
];

@Injectable()
export class CurrenciesService {
  constructor(private prisma: PrismaService) {}

  async seedDefaults() {
    const count = await this.prisma.currency.count();
    if (count > 0) return { seeded: 0 };
    await this.prisma.currency.createMany({ data: DEFAULT_CURRENCIES });
    return { seeded: DEFAULT_CURRENCIES.length };
  }

  async list() {
    return this.prisma.currency.findMany({ orderBy: [{ isBase: 'desc' }, { code: 'asc' }] });
  }

  async upsert(code: string, data: { symbol: string; nameAr: string; nameEn: string; rate: number; isBase?: boolean }) {
    if (data.rate === undefined || data.rate <= 0) throw new BadRequestException('Rate must be a positive number');
    const existing = await this.prisma.currency.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Currency not found');
    if (data.isBase) {
      await this.prisma.currency.updateMany({ where: { isBase: true }, data: { isBase: false } });
    } else if (existing.isBase) {
      throw new BadRequestException('Cannot unset the base currency. Set another currency as base first.');
    }
    return this.prisma.currency.update({
      where: { code },
      data: { symbol: data.symbol, nameAr: data.nameAr, nameEn: data.nameEn, rate: data.rate, isBase: data.isBase ?? existing.isBase },
    });
  }

  async create(code: string, data: { symbol: string; nameAr: string; nameEn: string; rate: number }) {
    if (data.rate === undefined || data.rate <= 0) throw new BadRequestException('Rate must be a positive number');
    const existing = await this.prisma.currency.findUnique({ where: { code } });
    if (existing) throw new BadRequestException('Currency already exists');
    return this.prisma.currency.create({ data: { code: code.toUpperCase(), symbol: data.symbol, nameAr: data.nameAr, nameEn: data.nameEn, rate: data.rate, isBase: false } });
  }

  async delete(code: string) {
    const currency = await this.prisma.currency.findUnique({ where: { code } });
    if (!currency) throw new NotFoundException('Currency not found');
    if (currency.isBase) throw new BadRequestException('Cannot delete the base currency');
    return this.prisma.currency.delete({ where: { code } });
  }

  /** Convert an amount from the currency of the opening into the requested display currency. */
  async convert(amount: number, from: string, to: string): Promise<{ converted: number; from: string; to: string; rate: number; amount: number }> {
    const base = await this.prisma.currency.findUnique({ where: { code: from } });
    const target = await this.prisma.currency.findUnique({ where: { code: to } });
    if (!base || !target) throw new NotFoundException('Currency not found');
    const rate = Number(base.rate) / Number(target.rate);
    return { amount, from, to, rate, converted: Math.round((amount * rate + Number.EPSILON) * 100) / 100 };
  }
}