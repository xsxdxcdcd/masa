import { Module } from '@nestjs/common';
import { InstructorApplicationsController } from './instructor-applications.controller';
import { AdminInstructorApplicationsController } from './admin-instructor-applications.controller';
import { InstructorApplicationsService } from './instructor-applications.service';

@Module({
  controllers: [InstructorApplicationsController, AdminInstructorApplicationsController],
  providers: [InstructorApplicationsService]
})
export class InstructorApplicationsModule {}
