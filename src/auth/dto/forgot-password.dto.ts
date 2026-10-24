import { IsNotEmpty, IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
    @ApiProperty({ description: 'Email address to send the reset link to', example: 'user@example.com' })
    @IsString()
    @IsNotEmpty()
    @IsEmail({}, { message: 'A valid email address is required' })
    email!: string;
}
