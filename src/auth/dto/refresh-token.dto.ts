import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
    @ApiProperty({ description: 'Opaque refresh token issued alongside the access token' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(256)
    refreshToken!: string;
}
