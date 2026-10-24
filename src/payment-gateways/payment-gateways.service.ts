import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentGatewayDto, UpdatePaymentGatewayDto } from './dto/payment-gateway.dto';

@Injectable()
export class PaymentGatewaysService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService
    ) { }

    async getAllGateways() {
        return this.prisma.paymentGateway.findMany({
            orderBy: { createdAt: 'asc' }
        });
    }

    async getActiveGateways() {
        return this.prisma.paymentGateway.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' }
        });
    }

    async createGateway(data: CreatePaymentGatewayDto, userId?: string) {
        const gateway = await this.prisma.paymentGateway.create({
            data: {
                name: data.name.trim(),
                instructions: data.instructions.trim(),
                walletGuideImageUrl: this.emptyToNull(data.walletGuideImageUrl),
                // Omitted (SQL NULL) when the admin never set any, so "no guide"
                // is never confused with an empty list.
                ...(data.guideImages !== undefined ? { guideImages: this.normaliseImages(data.guideImages) } : {}),
                guideVideoUrl: this.emptyToNull(data.guideVideoUrl),
                isActive: data.isActive ?? true,
            }
        });

        if (userId) {
            await this.auditService.logAction('CREATE_PAYMENT_GATEWAY', undefined, userId);
        }

        return gateway;
    }

    async updateGateway(id: string, data: UpdatePaymentGatewayDto, userId?: string) {
        // Build the patch explicitly: a blanket spread would let a client write
        // arbitrary columns, and it also meant an emptied guide field could never
        // be cleared.
        const patch: Prisma.PaymentGatewayUpdateInput = {};
        if (data.name !== undefined) patch.name = data.name.trim();
        if (data.instructions !== undefined) patch.instructions = data.instructions.trim();
        if (data.walletGuideImageUrl !== undefined) patch.walletGuideImageUrl = this.emptyToNull(data.walletGuideImageUrl);
        if (data.guideImages !== undefined) patch.guideImages = this.normaliseImages(data.guideImages);
        if (data.guideVideoUrl !== undefined) patch.guideVideoUrl = this.emptyToNull(data.guideVideoUrl);
        if (data.isActive !== undefined) patch.isActive = data.isActive;

        const gateway = await this.prisma.paymentGateway.update({
            where: { id },
            data: patch
        }).catch((e) => this.rethrow(e));

        if (userId) {
            await this.auditService.logAction('UPDATE_PAYMENT_GATEWAY', undefined, userId);
        }
        return gateway;
    }

    async deleteGateway(id: string, userId?: string) {
        await this.prisma.paymentGateway.delete({ where: { id } }).catch((e) => this.rethrow(e));
        if (userId) {
            await this.auditService.logAction('DELETE_PAYMENT_GATEWAY', undefined, userId);
        }
    }

    /** An empty string is how the old form cleared optional media; store null instead. */
    private emptyToNull(value?: string | null): string | null {
        const trimmed = value?.trim();
        return trimmed ? trimmed : null;
    }

    /**
     * Clearing the guide is a real operation the admin can perform, so an empty
     * list maps to DbNull (SQL NULL) instead of being silently dropped.
     */
    private normaliseImages(value?: string[] | null): string[] | typeof Prisma.DbNull {
        const cleaned = (value ?? []).map((v) => v?.trim()).filter((v): v is string => !!v);
        return cleaned.length > 0 ? cleaned : Prisma.DbNull;
    }

    /**
     * These mutations previously reported every failure as "Gateway not found",
     * which hid unique-name violations and connectivity problems behind a 404.
     */
    private rethrow(e: unknown): never {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2025') throw new NotFoundException('Payment gateway not found');
            if (e.code === 'P2002') throw new ConflictException('A payment method with this name already exists');
            if (e.code === 'P2003') throw new BadRequestException('This payment method is still referenced and cannot be changed');
        }
        throw e;
    }
}
