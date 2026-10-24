import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ description: 'User login email', example: 'user@laxalab.com' })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({ description: 'User password', example: 'StrongPassword123' })
    @IsString()
    @IsNotEmpty()
    password!: string;
}
