import { IsNotEmpty, IsString, MinLength, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty({ description: 'One-time token issued by login when a password change is required' })
    @IsString()
    @IsNotEmpty()
    tempToken!: string;

    @ApiProperty({ description: 'New password (8–128 chars, must contain uppercase, lowercase, and number)', example: 'NewStrongPass123' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @MaxLength(128, { message: 'Password must not exceed 128 characters' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    })
    newPassword!: string;
}