import { PartialType } from '@nestjs/mapped-types';
import {
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsOptional,
    IsString,
    IsUrl,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateLearningPathDto {
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    titleAr!: string;

    @IsString()
    @MinLength(1)
    @MaxLength(120)
    titleEn!: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    descriptionAr?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    descriptionEn?: string;

    @IsOptional()
    @IsUrl({ require_protocol: true })
    @MaxLength(2048)
    coverImageUrl?: string | null;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsUUID('4', { each: true })
    courseIds?: string[];

    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;
}

export class UpdateLearningPathDto extends PartialType(CreateLearningPathDto) {}
