import { IsEnum, IsOptional, IsString, MaxLength, IsIn, IsNumber, IsArray, IsBoolean, IsDateString, ArrayMaxSize, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckoutDto {
    @ApiProperty({ description: 'Opening (batch) id to check out for' })
    @IsString()
    openingId!: string;

    @ApiPropertyOptional({ enum: ['MANUAL', 'STRIPE'], description: 'Payment provider' })
    @IsOptional()
    @IsIn(['MANUAL', 'STRIPE'])
    provider?: 'MANUAL' | 'STRIPE';

    @ApiPropertyOptional({ description: 'Coupon code (uppercased server-side)' })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    couponCode?: string;
}

export class RefundPaymentDto {
    @ApiPropertyOptional({ enum: ['duplicate', 'fraudulent', 'requested_by_customer'], description: 'Reason for the refund (Stripe-compatible)' })
    @IsOptional()
    @IsIn(['duplicate', 'fraudulent', 'requested_by_customer'])
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

const COUPON_TYPES = ['PERCENT', 'AMOUNT'] as const;

export class CreateCouponDto {
    @ApiProperty({ description: 'Coupon code (uppercased server-side)' })
    @IsString()
    @MaxLength(64)
    code!: string;

    @ApiProperty({ enum: COUPON_TYPES })
    @IsEnum(COUPON_TYPES)
    type!: 'PERCENT' | 'AMOUNT';

    @ApiProperty({ description: 'Discount value: percent off (1-100, PERCENT) or fixed amount (AMOUNT)' })
    @IsNumber()
    @Min(0.01)
    @Max(1_000_000)
    value!: number;

    @ApiPropertyOptional({ description: 'Maximum number of uses (null = unlimited)' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    maxUses?: number;

    @ApiPropertyOptional({ description: 'Activate immediately (default true)' })
    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @ApiPropertyOptional({ description: 'ISO start timestamp' })
    @IsOptional()
    @IsDateString()
    startsAt?: Date;

    @ApiPropertyOptional({ description: 'ISO expiry timestamp' })
    @IsOptional()
    @IsDateString()
    expiresAt?: Date;

    @ApiPropertyOptional({ type: [String], description: 'Course ids the coupon applies to (empty = all courses)' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500)
    @IsString({ each: true })
    courseIds?: string[];
}

export class UpdateCouponDto {
    @ApiPropertyOptional({ description: 'Coupon code (uppercased server-side)' })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    code?: string;

    @ApiPropertyOptional({ enum: COUPON_TYPES })
    @IsOptional()
    @IsEnum(COUPON_TYPES)
    type?: 'PERCENT' | 'AMOUNT';

    @ApiPropertyOptional({ description: 'Discount value: percent off (1-100, PERCENT) or fixed amount (AMOUNT)' })
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    @Max(1_000_000)
    value?: number;

    @ApiPropertyOptional({ description: 'Maximum number of uses (null = unlimited)' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    maxUses?: number;

    @ApiPropertyOptional({ description: 'Activate immediately (default true)' })
    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @ApiPropertyOptional({ description: 'ISO start timestamp' })
    @IsOptional()
    @IsDateString()
    startsAt?: Date;

    @ApiPropertyOptional({ description: 'ISO expiry timestamp' })
    @IsOptional()
    @IsDateString()
    expiresAt?: Date;

    @ApiPropertyOptional({ type: [String], description: 'Course ids the coupon applies to (empty = all courses)' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500)
    @IsString({ each: true })
    courseIds?: string[];
}