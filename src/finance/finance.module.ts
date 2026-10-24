import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { AdminFinanceController } from './admin-finance.controller';

@Module({
    controllers: [FinanceController, AdminFinanceController],
    providers: [FinanceService],
    exports: [FinanceService],
})
export class FinanceModule {}
