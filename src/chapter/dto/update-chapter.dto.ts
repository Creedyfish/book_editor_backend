import { PartialType } from '@nestjs/mapped-types';
import { CreateChapterDto } from './create-chapter.dto';

export class UpdateChapterDto extends PartialType(CreateChapterDto) {}

// src/chapters/dto/chapter-response.dto.ts
// export class ChapterResponseDto {
//   id: string;
//   bookId: string;
//   title: string;
//   description?: string;
//   content: any;
//   order: number;
//   wordCount: number;
//   createdAt: Date;
//   updatedAt: Date;
// }
