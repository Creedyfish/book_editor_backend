import { Type } from 'class-transformer';
import { IsInt, Min, IsOptional } from 'class-validator';

export class ChapterQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number;

  // Optional: you can add `search` or `sortBy` here later
}
