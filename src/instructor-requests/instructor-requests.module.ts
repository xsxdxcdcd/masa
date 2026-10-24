import { Module } from '@nestjs/common';
import { InstructorRequestsService } from './instructor-requests.service';
import { InstructorRequestsController } from './instructor-requests.controller';
import { CoursesModule } from '../courses/courses.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [CoursesModule, NotificationsModule],
    controllers: [InstructorRequestsController],
    providers: [InstructorRequestsService],
})
export class InstructorRequestsModule { }