import { Module } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';
import { PublicCertificatesController } from './public-certificates.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [NotificationsModule],
    controllers: [CertificatesController, PublicCertificatesController],
    providers: [CertificatesService],
    exports: [CertificatesService],
})
export class CertificatesModule { }