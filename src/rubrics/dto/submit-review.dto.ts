import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriterionScoreDto {
    @ApiProperty({ description: 'RubricCriterion id being scored' })
    @IsUUID()
    criterionId!: string;

    @ApiPropertyOptional({ description: 'Points awarded. Clamped server-side to that criterion maxScore.' })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(1000)
    score!: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    commentAr?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    commentEn?: string;
}

export class SubmitReviewDto {
    @ApiProperty({ description: 'TaskSubmission being reviewed' })
    @IsUUID()
    submissionId!: string;

    @ApiProperty({ type: [CriterionScoreDto] })
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => CriterionScoreDto)
    scores!: CriterionScoreDto[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    commentAr?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    commentEn?: string;
}
