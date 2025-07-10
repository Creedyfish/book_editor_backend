import { IsString } from 'class-validator';

export class VerifyEmailCodeDto {
  @IsString()
  code: string;
}
