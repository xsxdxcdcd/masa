import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum, IsBoolean, IsObject, Length } from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ description: 'User email address', example: 'newuser@laxalab.com' })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({ description: 'User password, 6 chars min', example: 'mySecretPass' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password!: string;

    @ApiPropertyOptional({ description: 'Role assignment', enum: Role, example: Role.STUDENT })
    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @ApiPropertyOptional({ description: 'Whether the account is active (suspended when false)', default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Force the user to set a new password on their next login', default: true })
    @IsOptional()
    @IsBoolean()
    mustChangePassword?: boolean;
}

export class UpdateUserDto {
    @ApiPropertyOptional({ description: 'User email address', example: 'updated@laxalab.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ description: 'User password, 6 chars min' })
    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @ApiPropertyOptional({ description: 'Role assignment', enum: Role })
    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @ApiPropertyOptional({ description: 'Whether the account is active (suspended when false)', default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Force the user to set a new password on their next login' })
    @IsOptional()
    @IsBoolean()
    mustChangePassword?: boolean;
}

export class UpdateMeDto {
    @ApiPropertyOptional({ description: 'New email address. Requires currentPassword.' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ description: 'New password, 6 chars min. Requires currentPassword.' })
    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @ApiPropertyOptional({ description: 'Current password, required when changing email or password.' })
    @IsOptional()
    @IsString()
    currentPassword?: string;

    @ApiPropertyOptional({ description: 'Personal info to merge into the user metadata.' })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;

    @ApiPropertyOptional({ description: 'Preferred UI language (ISO 639-1 code).', example: 'en' })
    @IsOptional()
    @IsString()
    @Length(2, 5)
    language?: string;
}
