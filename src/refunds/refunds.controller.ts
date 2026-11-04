import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';
import { CreateRefundRequestDto, ReviewRefundRequestDto } from './dto/refund.dto';

@ApiTags('Refunds')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('refunds')
export class RefundsController {
    constructor(private readonly refunds: RefundsService) { }

    @ApiOperation({ summary: 'Paid courses the student can request a refund for (window + status)' })
    @Roles(Role.STUDENT)
    @Get('eligibility')
    eligibility(@Request() req: any) {
        return this.refunds.getMyEligibility(req.user.userId);
    }

    @ApiOperation({ summary: 'My refund requests' })
    @Roles(Role.STUDENT)
    @Get('mine')
    mine(@Request() req: any) {
        return this.refunds.listMine(req.user.userId);
    }

    @ApiOperation({ summary: 'Submit a refund request for a paid course' })
    @Roles(Role.STUDENT)
    @Post()
    create(@Request() req: any, @Body() dto: CreateRefundRequestDto) {
        return this.refunds.create(req.user.userId, dto);
    }

    @ApiOperation({ summary: 'List refund requests (finance/admin); optional ?status=PENDING' })
    @Roles(Role.FINANCE, Role.ADMIN)
    @RequirePermissions(PERMISSIONS.REFUNDS_REVIEW)
    @Get()
    list(@Query('status') status?: string) {
        return this.refunds.listAll(status);
    }

    @ApiOperation({ summary: 'Approve or reject a refund request (finance/admin)' })
    @Roles(Role.FINANCE, Role.ADMIN)
    @RequirePermissions(PERMISSIONS.REFUNDS_REVIEW)
    @Patch(':id')
    review(@Param('id') id: string, @Body() dto: ReviewRefundRequestDto, @Request() req: any) {
        return this.refunds.review(id, req.user.userId, req.user.role, dto);
    }
}
