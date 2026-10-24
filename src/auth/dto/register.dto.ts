import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, Matches, Validate } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'isPastDate', async: false })
class IsPastDateConstraint implements ValidatorConstraintInterface {
    validate(value: string) {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed.getTime() <= Date.now();
    }

    defaultMessage(args: ValidationArguments) {
        return `${args.property} must be a valid date in the past (YYYY-MM-DD)`;
    }
}

function IsPastDate(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: IsPastDateConstraint,
        });
    };
}

export class RegisterDto {
    @ApiProperty({ description: 'User email address', example: 'newuser@laxalab.com' })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({ description: 'User password (min 8 chars, must contain uppercase, lowercase, and number)', example: 'MySecret123' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    })
    password!: string;

    @ApiPropertyOptional({ description: 'Full name', example: 'Jane Doe' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    fullName?: string;

    @ApiPropertyOptional({ description: 'Phone number', example: '+1 234 567 890' })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    phone?: string;

    @ApiPropertyOptional({ description: 'Gender (MALE | FEMALE | OTHER)', enum: ['MALE', 'FEMALE', 'OTHER'] })
    @IsOptional()
    @IsString()
    gender?: string;

    @ApiPropertyOptional({ description: 'Date of birth (YYYY-MM-DD)', example: '2001-05-14' })
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate must use the YYYY-MM-DD format' })
    @Validate(IsPastDate())
    birthDate?: string;

    @ApiPropertyOptional({ description: 'University / Institute', example: 'University of Baghdad' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    university?: string;

    @ApiPropertyOptional({ description: 'Field of study / specialty', example: 'Computer Science' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    specialty?: string;

    @ApiPropertyOptional({ description: 'Study status (STUDENT | GRADUATE | OTHER)', enum: ['STUDENT', 'GRADUATE', 'OTHER'] })
    @IsOptional()
    @IsString()
    studyStatus?: string;

    @ApiPropertyOptional({ description: 'Current study level / year', example: 'Third Year' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    studyLevel?: string;
}