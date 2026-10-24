import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

@ApiTags('Finance Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('api/admin/finance')
export class AdminFinanceController {
    constructor(private readonly financeService: FinanceService) {}

    @ApiOperation({ summary: 'Payment report & analytics' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_READ)
    @Get('reports')
    getPaymentReport() {
        return this.financeService.getPaymentReport();
    }

    @ApiOperation({ summary: 'List all coupons with courses and redemption counts' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_READ)
    @Get('coupons')
    getCoupons() {
        return this.financeService.getCoupons();
    }

    @ApiOperation({ summary: 'Per-coupon statistics (uses, discounts, students, per-course)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_READ)
    @Get('coupons/:id/stats')
    getCouponStats(@Param('id') id: string) {
        return this.financeService.getCouponStats(id);
    }

    @ApiOperation({ summary: 'Create a coupon (finance or admin)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Post('coupons')
    createCoupon(@Body() dto: CreateCouponDto) {
        return this.financeService.createCoupon(dto);
    }

    @ApiOperation({ summary: 'Update a coupon (finance or admin)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Patch('coupons/:id')
    updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
        return this.financeService.updateCoupon(id, dto);
    }

    @ApiOperation({ summary: 'Delete a coupon (only if never redeemed)' })
    @Roles(Role.ADMIN, Role.FINANCE)
    @RequirePermissions(PERMISSIONS.FINANCE_WRITE)
    @Delete('coupons/:id')
    deleteCoupon(@Param('id') id: string) {
        return this.financeService.deleteCoupon(id);
    }
}
