import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private prisma: PrismaService) { }

    async logAction(action: string, ipAddress?: string, userId?: string) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    action,
                    ipAddress,
                    userId,
                },
            });
        } catch (error) {
            this.logger.error(`Failed to record audit log: ${action}`, error);
        }
    }
}
