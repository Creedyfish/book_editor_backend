import { IsEnum } from 'class-validator';

export enum EmailPurpose {
  EMAIL_VERIFICATION = 'email-verification',
  PASSWORD_RESET = 'password-reset',
}

export class EmailPurposeDto {
  @IsEnum(EmailPurpose)
  purpose: EmailPurpose;
}
