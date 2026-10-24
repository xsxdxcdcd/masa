import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
    imports: [GamificationModule],
    controllers: [LessonsController, QuizzesController, ReviewsController],
    providers: [LessonsService, QuizzesService, ReviewsService],
    exports: [LessonsService, QuizzesService, ReviewsService],
})
export class LmsModule { }