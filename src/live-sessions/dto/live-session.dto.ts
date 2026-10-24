import { IsString, IsOptional, IsInt, Min, Max, IsDateString, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { toIsoDate } from '../../common/date-transform';

export class CreateLiveSessionDto {
    @ApiProperty({ description: 'Session title in Arabic', example: 'الجلسة الأولى: أساسيات' })
    @IsString()
    @IsNotEmpty()
    titleAr!: string;

    @ApiProperty({ description: 'Session title in English', example: 'Session 1: fundamentals' })
    @IsString()
    @IsNotEmpty()
    titleEn!: string;

    @ApiProperty({ description: 'When the session starts (ISO)', example: '2026-10-07T19:00:00.000Z' })
    @IsDateString()
    @Transform(toIsoDate)
    scheduledAt!: string;

    @ApiPropertyOptional({ description: 'Length in minutes; the UI shows the end time from it', example: 90 })
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(5)
    @Max(600)
    durationMinutes?: number | null;

    @ApiPropertyOptional({
        description:
            'Room for this one session (https, Google Meet / Zoom / Teams). Leave empty to reuse the ' +
            'batch link, which is how a recurring weekly class is scheduled.',
        example: 'https://meet.google.com/abc-defg-hij',
    })
    @IsOptional()
    @IsString()
    meetLink?: string | null;
}