import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAnnouncementBoardDto {
    @ApiProperty({ description: 'Title in Arabic' })
    @IsString()
    @IsNotEmpty()
    titleAr!: string;

    @ApiProperty({ description: 'Title in English' })
    @IsString()
    @IsNotEmpty()
    titleEn!: string;

    @ApiPropertyOptional({ description: 'Body text in Arabic' })
    @IsOptional()
    @IsString()
    bodyAr?: string;

    @ApiPropertyOptional({ description: 'Body text in English' })
    @IsOptional()
    @IsString()
    bodyEn?: string;

    @ApiPropertyOptional({ description: 'Media type: none, image, or video', enum: ['none', 'image', 'video'] })
    @IsOptional()
    @IsString()
    mediaType?: string;

    @ApiPropertyOptional({ description: 'URL of media asset' })
    @IsOptional()
    @IsString()
    mediaUrl?: string;

    @ApiPropertyOptional({ description: 'External link URL' })
    @IsOptional()
    @IsString()
    linkUrl?: string;

    @ApiPropertyOptional({ description: 'Priority (higher = shown first)', default: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    priority?: number;

    @ApiPropertyOptional({ description: 'Whether the announcement is active', default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Auto-rotate duration in seconds (1-300)', default: 5 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(300)
    durationSeconds?: number;

    @ApiPropertyOptional({ description: 'Start date for visibility' })
    @IsOptional()
    startsAt?: Date;

    @ApiPropertyOptional({ description: 'Expiry date for visibility' })
    @IsOptional()
    expiresAt?: Date;
}
