import {
    IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsBoolean, IsEnum, IsArray,
    ValidateNested, IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseContentType, CourseLevel } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';

export class CreateLearningOutcomeDto {
    @ApiProperty({ description: 'Arabic learning outcome description' })
    @IsString()
    @IsNotEmpty()
    descriptionAr!: string;

    @ApiProperty({ description: 'English learning outcome description' })
    @IsString()
    @IsNotEmpty()
    descriptionEn!: string;
}

export class CreateModuleDto {
    @ApiProperty({ description: 'Arabic module title' })
    @IsString()
    @IsNotEmpty()
    titleAr!: string;

    @ApiProperty({ description: 'English module title' })
    @IsString()
    @IsNotEmpty()
    titleEn!: string;

    @ApiPropertyOptional({ description: 'Arabic module description' })
    @IsOptional()
    @IsString()
    descriptionAr?: string;

    @ApiPropertyOptional({ description: 'English module description' })
    @IsOptional()
    @IsString()
    descriptionEn?: string;

    @ApiPropertyOptional({ description: 'Remote lesson video link (YouTube/Vimeo/Direct)' })
    @IsOptional()
    @IsString()
    videoUrl?: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    orderIndex?: number;

    @ApiPropertyOptional({ description: 'Approximate lesson length in minutes', example: 15 })
    @IsOptional()
    @IsInt()
    @Min(0)
    durationMinutes?: number;

    @ApiPropertyOptional({ type: [CreateLearningOutcomeDto], description: 'Learning outcomes for this module' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateLearningOutcomeDto)
    outcomes?: CreateLearningOutcomeDto[];

    @IsOptional()
    @IsArray()
    files?: { url: string; nameAr?: string; nameEn?: string }[];

    @IsOptional()
    @IsArray()
    links?: { url: string; labelAr?: string; labelEn?: string }[];
}

export class CreateChapterDto {
    @ApiProperty({ description: 'Arabic chapter title' })
    @IsString()
    @IsNotEmpty()
    titleAr!: string;

    @ApiProperty({ description: 'English chapter title' })
    @IsString()
    @IsNotEmpty()
    titleEn!: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    orderIndex?: number;

    @ApiPropertyOptional({ type: [CreateModuleDto], description: 'Lessons (modules) that belong to this chapter' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateModuleDto)
    modules?: CreateModuleDto[];
}

export class CreateObjectiveDto {
    @ApiProperty({ description: 'Arabic learning objective (what you will learn)' })
    @IsString()
    @IsNotEmpty()
    objectiveAr!: string;

    @ApiProperty({ description: 'English learning objective' })
    @IsString()
    @IsNotEmpty()
    objectiveEn!: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    orderIndex?: number;
}

export class CreatePrerequisiteDto {
    @ApiProperty({ description: 'Arabic prerequisite' })
    @IsString()
    @IsNotEmpty()
    prerequisiteAr!: string;

    @ApiProperty({ description: 'English prerequisite' })
    @IsString()
    @IsNotEmpty()
    prerequisiteEn!: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    orderIndex?: number;
}

export class CreateAudienceDto {
    @ApiProperty({ description: 'Arabic target audience item' })
    @IsString()
    @IsNotEmpty()
    audienceAr!: string;

    @ApiProperty({ description: 'English target audience item' })
    @IsString()
    @IsNotEmpty()
    audienceEn!: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    orderIndex?: number;
}

export class CreateFaqDto {
    @ApiProperty({ description: 'Arabic FAQ question' })
    @IsString()
    @IsNotEmpty()
    questionAr!: string;

    @ApiProperty({ description: 'English FAQ question' })
    @IsString()
    @IsNotEmpty()
    questionEn!: string;

    @ApiProperty({ description: 'Arabic FAQ answer' })
    @IsString()
    @IsNotEmpty()
    answerAr!: string;

    @ApiProperty({ description: 'English FAQ answer' })
    @IsString()
    @IsNotEmpty()
    answerEn!: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    orderIndex?: number;
}

export class CreateGalleryImageDto {
    @ApiProperty({ description: 'Gallery image URL' })
    @IsString()
    @IsNotEmpty()
    url!: string;

    @ApiPropertyOptional({ description: 'Arabic alt text' })
    @IsOptional()
    @IsString()
    altAr?: string;

    @ApiPropertyOptional({ description: 'English alt text' })
    @IsOptional()
    @IsString()
    altEn?: string;

    @ApiPropertyOptional({ example: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    orderIndex?: number;
}

export class CreateCourseDto {
    @ApiProperty({ description: 'Arabic course title' })
    @IsString()
    @IsNotEmpty()
    titleAr!: string;

    @ApiProperty({ description: 'English course title' })
    @IsString()
    @IsNotEmpty()
    titleEn!: string;

    @ApiPropertyOptional({ description: 'Arabic short excerpt for cards' })
    @IsOptional()
    @IsString()
    excerptAr?: string;

    @ApiPropertyOptional({ description: 'English short excerpt for cards' })
    @IsOptional()
    @IsString()
    excerptEn?: string;

    @ApiPropertyOptional({ description: 'Arabic course description' })
    @IsOptional()
    @IsString()
    descriptionAr?: string;

    @ApiPropertyOptional({ description: 'English course description' })
    @IsOptional()
    @IsString()
    descriptionEn?: string;

    @ApiPropertyOptional({ description: 'Arabic category' })
    @IsOptional()
    @IsString()
    categoryAr?: string;

    @ApiPropertyOptional({ description: 'English category' })
    @IsOptional()
    @IsString()
    categoryEn?: string;

    @ApiPropertyOptional({ enum: CourseLevel, default: CourseLevel.BEGINNER })
    @IsOptional()
    @IsEnum(CourseLevel)
    level?: CourseLevel;

    @ApiProperty({
        enum: CourseContentType,
        default: CourseContentType.LIVE,
        description:
            'LIVE: lessons are held as Meet sessions on a schedule (no lesson videos). ' +
            'RECORDED: lessons are pre-recorded videos (no live sessions).',
    })
    @IsEnum(CourseContentType)
    contentType!: CourseContentType;

    @ApiPropertyOptional({ description: 'Course language, e.g. Arabic, English, Bilingual' })
    @IsOptional()
    @IsString()
    language?: string;

    @ApiPropertyOptional({ description: 'Total hours of content' })
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    hoursOfContent?: number;

    @ApiPropertyOptional({ description: 'Arabic syllabus' })
    @IsOptional()
    @IsString()
    syllabusAr?: string;

    @ApiPropertyOptional({ description: 'English syllabus' })
    @IsOptional()
    @IsString()
    syllabusEn?: string;

    @ApiPropertyOptional({ description: 'Arabic duration (display text)' })
    @IsOptional()
    @IsString()
    durationAr?: string;

    @ApiPropertyOptional({ description: 'English duration (display text)' })
    @IsOptional()
    @IsString()
    durationEn?: string;

    @ApiPropertyOptional({ description: 'Cover image URL (uploaded file)' })
    @IsOptional()
    @IsString()
    coverImageUrl?: string;

    @ApiPropertyOptional({ description: 'Intro/promo video URL (YouTube/Vimeo/Direct)' })
    @IsOptional()
    @IsString()
    introVideoUrl?: string;

    @ApiPropertyOptional({ description: 'Uploaded video file URL' })
    @IsOptional()
    @IsString()
    videoFileUrl?: string;

    @ApiPropertyOptional({ description: 'Issues a certificate on completion', default: false })
    @IsOptional()
    @IsBoolean()
    certificateIssued?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    quizzesIncluded?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    projectsIncluded?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    assignmentsIncluded?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    liveSessionsIncluded?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    downloadableResources?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    lifetimeAccess?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    communityAccess?: boolean;

    @ApiPropertyOptional({ type: [CreateModuleDto], description: 'Course structure / modules' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateModuleDto)
    modules?: CreateModuleDto[];

    @ApiPropertyOptional({ type: [CreateChapterDto], description: 'Course chapters, each holding its lessons (modules)' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateChapterDto)
    chapters?: CreateChapterDto[];

    @ApiPropertyOptional({ type: [CreateObjectiveDto], description: 'What you will learn' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateObjectiveDto)
    objectives?: CreateObjectiveDto[];

    @ApiPropertyOptional({ type: [CreatePrerequisiteDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreatePrerequisiteDto)
    prerequisites?: CreatePrerequisiteDto[];

    @ApiPropertyOptional({ type: [CreateAudienceDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateAudienceDto)
    audiences?: CreateAudienceDto[];

    @ApiPropertyOptional({ type: [CreateFaqDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateFaqDto)
    faqs?: CreateFaqDto[];

    @ApiPropertyOptional({ type: [CreateGalleryImageDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateGalleryImageDto)
    gallery?: CreateGalleryImageDto[];
}

/// PATCH input: every field optional — sending a single field must update
/// ONLY that field (no nested collection is wiped unless explicitly provided).
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}