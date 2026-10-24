import { Module } from '@nestjs/common';
import { LiveSessionsService } from './live-sessions.service';
import { LiveSessionsController } from './live-sessions.controller';
import { CoursesModule } from '../courses/courses.module';

// AuditService comes from the @Global AuditModule, PrismaService likewise.
@Module({
    imports: [CoursesModule],
    controllers: [LiveSessionsController],
    providers: [LiveSessionsService],
})
export class LiveSessionsModule { }