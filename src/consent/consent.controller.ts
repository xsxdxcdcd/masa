import { Controller, Post, Body, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service';

interface ConsentBody {
    analytics?: boolean;
    marketing?: boolean;
}

@ApiTags('Consent')
@Controller('consent')
export class ConsentController {
    constructor(private readonly audit: AuditService) {}

    @ApiOperation({ summary: 'Record cookie consent preferences (GDPR)' })
    @Post()
    async record(@Body() body: ConsentBody, @Ip() ip: string) {
        const analytics = !!body?.analytics;
        const marketing = !!body?.marketing;
        await this.audit.logAction(`Cookie consent: analytics=${analytics}, marketing=${marketing}`, ip);
        return { ok: true };
    }
}