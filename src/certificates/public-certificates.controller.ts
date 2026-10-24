import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';

@ApiTags('Public Certificate Verification')
@Controller('certificates')
export class PublicCertificatesController {
    constructor(private readonly certificatesService: CertificatesService) {}

    @ApiOperation({ summary: 'Public certificate verification (no auth required)' })
    @Get('verify/:code')
    verify(@Param('code') code: string) {
        return this.certificatesService.verifyByCode(code);
    }

    @ApiOperation({ summary: 'Public certificate view by ID (no auth required)' })
    @Get('public/:id')
    getPublic(@Param('id') id: string) {
        return this.certificatesService.getPublicById(id);
    }
}