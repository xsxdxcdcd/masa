import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { AdminGamificationController } from './admin-gamification.controller';

@Module({
    controllers: [GamificationController, AdminGamificationController],
    providers: [GamificationService],
    exports: [GamificationService],
})
export class GamificationModule {}
