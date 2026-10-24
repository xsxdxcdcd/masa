import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    ArrayMaxSize,
    Max,
    MaxLength,
    Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponMaxScope, CouponType } from '@prisma/client';

const COUPON_TYPES = ['PERCENT', 'AMOUNT'] as const;

export class CreateCouponDto {
    @ApiProperty({ description: 'Human-readable label shown in finance/admin' })
    @IsString()
    @MaxLength(120)
    name!: string;

    @ApiProperty({ description: 'Coupon code the student types (uppercased server-side)' })
    @IsString()
    @MaxLength(64)
    code!: string;

    @ApiProperty({ enum: COUPON_TYPES })
    @IsEnum(COUPON_TYPES)
    type!: 'PERCENT' | 'AMOUNT';

    @ApiProperty({ description: 'Percent off (1-100) for PERCENT, or a fixed amount for AMOUNT' })
    @IsNumber()
    @Min(0.01)
    @Max(1_000_000)
    value!: number;

    @ApiPropertyOptional({ description: 'First N uses. Omit for unlimited.' })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1_000_000)
    maxUses?: number | null;

    @ApiPropertyOptional({ enum: CouponMaxScope, description: 'TOTAL caps all uses; PER_COURSE caps each targeted course' })
    @IsOptional()
    @IsEnum(CouponMaxScope)
    maxUsesScope?: CouponMaxScope;

    @ApiPropertyOptional({ description: 'Who the coupon belongs to (attribution)' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    sourceName?: string | null;

    @ApiPropertyOptional({ description: 'Channel the coupon spread through (attribution)' })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    channel?: string | null;

    @ApiPropertyOptional({ description: 'Activate immediately (default true)' })
    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @ApiPropertyOptional({ description: 'ISO start timestamp' })
    @IsOptional()
    @IsDateString()
    startsAt?: string | null;

    @ApiPropertyOptional({ description: 'ISO expiry timestamp' })
    @IsOptional()
    @IsDateString()
    expiresAt?: string | null;

    @ApiPropertyOptional({ type: [String], description: 'Targeted course ids (empty/omitted = all courses)' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500)
    @IsString({ each: true })
    courseIds?: string[];
}

export class UpdateCouponDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(64)
    code?: string;

    @ApiPropertyOptional({ enum: COUPON_TYPES })
    @IsOptional()
    @IsEnum(COUPON_TYPES)
    type?: 'PERCENT' | 'AMOUNT';

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    @Max(1_000_000)
    value?: number;

    @ApiPropertyOptional({ description: 'First N uses. null = unlimited.' })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1_000_000)
    maxUses?: number | null;

    @ApiPropertyOptional({ enum: CouponMaxScope })
    @IsOptional()
    @IsEnum(CouponMaxScope)
    maxUsesScope?: CouponMaxScope;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(120)
    sourceName?: string | null;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(60)
    channel?: string | null;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    startsAt?: string | null;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    expiresAt?: string | null;

    @ApiPropertyOptional({ type: [String], description: 'Targeted course ids (empty = all courses)' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500)
    @IsString({ each: true })
    courseIds?: string[];
}

export class ValidateCouponDto {
    @ApiProperty({ description: 'Coupon code the student typed' })
    @IsString()
    @MaxLength(64)
    code!: string;

    @ApiPropertyOptional({ description: 'Course the coupon is being applied to' })
    @IsOptional()
    @IsString()
    courseId?: string;

    @ApiPropertyOptional({ description: 'Opening price, to preview the discounted amount' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    price?: number;
}
