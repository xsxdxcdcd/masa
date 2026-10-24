import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreatePaymentGatewayDto {
    @ApiProperty({ example: 'بنك الكريمي' })
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name!: string;

    @ApiProperty({ example: 'حوّل المبلغ إلى الحساب 12345678 باسم laxalab' })
    @IsString()
    @MinLength(5)
    @MaxLength(4000)
    instructions!: string;

    @ApiPropertyOptional({ description: 'Single wallet guide image (kept for backwards compatibility).' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    walletGuideImageUrl?: string | null;

    @ApiPropertyOptional({ type: [String], description: 'Step-by-step screenshots of the transfer.' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(8)
    @IsString({ each: true })
    @MaxLength(500, { each: true })
    guideImages?: string[] | null;

    @ApiPropertyOptional({ description: 'Walkthrough video of the transfer.' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    guideVideoUrl?: string | null;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdatePaymentGatewayDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MinLength(5)
    @MaxLength(4000)
    instructions?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    walletGuideImageUrl?: string | null;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(8)
    @IsString({ each: true })
    @MaxLength(500, { each: true })
    guideImages?: string[] | null;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    guideVideoUrl?: string | null;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
