import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
    @ApiProperty({ description: 'Email verification token received via the emailed link' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(256)
    token!: string;
}
