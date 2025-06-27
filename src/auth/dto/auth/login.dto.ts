import { IsString, IsEmail, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  token: string;
}

export class LoginStrategyDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
  })
  password: string;
}
