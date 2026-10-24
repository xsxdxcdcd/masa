import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RefundMethod } from '@prisma/client';

export class CreateRefundRequestDto {
    @ApiProperty({ description: 'Course the student wants refunded' })
    @IsString()
    courseId!: string;

    @ApiProperty({ enum: RefundMethod, description: 'WALLET (e-wallet) or BANK transfer' })
    @IsEnum(RefundMethod)
    method!: RefundMethod;

    @ApiProperty({ description: 'Account holder name' })
    @IsString()
    @MaxLength(120)
    accountName!: string;

    @ApiProperty({ description: 'Account number / IBAN / wallet number' })
    @IsString()
    @MaxLength(120)
    accountNumber!: string;

    @ApiPropertyOptional({ description: 'Optional note from the student' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    studentNote?: string;
}

const REVIEW_STATUSES = ['APPROVED', 'REJECTED'] as const;

export class ReviewRefundRequestDto {
    @ApiProperty({ enum: REVIEW_STATUSES })
    @IsEnum(REVIEW_STATUSES)
    status!: 'APPROVED' | 'REJECTED';

    @ApiPropertyOptional({ description: 'Reason / note shown to the student' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reviewerNote?: string;
}
