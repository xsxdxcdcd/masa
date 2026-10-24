import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReviewDecision {
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export class ReviewEnrollmentDto {
    @ApiProperty({ enum: ReviewDecision, description: 'Decision on the enrollment: APPROVED or REJECTED' })
    @IsEnum(ReviewDecision)
    status!: ReviewDecision;

    @ApiPropertyOptional({ description: 'Finance officer note attached to the decision' })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    notes?: string;
}

export class ReserveCourseDto {
    @ApiProperty({ description: 'Course id to reserve a seat in' })
    @IsString()
    courseId!: string;
}

export class AdminEnrollDto {
    @ApiProperty({ description: 'Course id to enroll the student in' })
    @IsString()
    courseId!: string;

    @ApiProperty({ description: 'Student user id to enroll' })
    @IsString()
    studentId!: string;

    @ApiPropertyOptional({ description: 'Opening (batch) id; when omitted the latest open opening is used' })
    @IsOptional()
    @IsString()
    openingId?: string;
}