import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ValidateCouponDto } from './dto/coupon.dto';

@ApiTags('Finance Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
    constructor(private readonly financeService: FinanceService) {}

    // Any authenticated user (i.e. a student before paying) may check a code.
    @ApiOperation({ summary: 'Validate a coupon code and preview the discount' })
    @Post('coupons/validate')
    validateCoupon(@Body() dto: ValidateCouponDto) {
        return this.financeService.validateCoupon(dto.code, dto.courseId, dto.price);
    }
}
