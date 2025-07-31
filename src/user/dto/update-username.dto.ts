import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateUsernameDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;
}
