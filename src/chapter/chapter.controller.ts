// src/chapters/chapters.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChapterService } from './chapter.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ChapterQueryDto } from './dto/query-chapter.dto';
import { OptionalJwtAuthGuard } from 'src/auth/optional.strategy';
@Controller('books/:bookId/chapters')
export class ChapterController {
  constructor(private readonly chaptersService: ChapterService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(
    @Param('bookId') bookId: string,
    @Body() createChapterDto: CreateChapterDto,
    @Request() req: any,
  ) {
    return this.chaptersService.create(bookId, createChapterDto, req.user.id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async findOne(
    @Param('bookId') bookId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    // Extract user ID if authenticated, but don't require authentication
    const userId = req.user?.id;
    return this.chaptersService.findOne(bookId, id, userId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Param('bookId') bookId: string,
    @Param('id') id: string,
    @Body() updateChapterDto: UpdateChapterDto,
    @Request() req: any,
  ) {
    return this.chaptersService.update(
      bookId,
      id,
      updateChapterDto,
      req.user.id,
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('bookId') bookId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    await this.chaptersService.remove(bookId, id, req.user.id);
  }

  @Post('reorder')
  @UseGuards(AuthGuard('jwt'))
  async reorderChapters(
    @Param('bookId') bookId: string,
    @Body() body: { chapters: { id: string; order: number }[] },
    @Request() req: any,
  ) {
    return this.chaptersService.reorderChapters(
      bookId,
      body.chapters,
      req.user.id,
    );
  }
}

// Alternative controller for authenticated-only access
// @Controller('books/:bookId/chapters')
// @UseGuards(AuthGuard('jwt'))
// export class AuthenticatedChaptersController {
//   constructor(private readonly chaptersService: ChapterService) {}

//   @Post()
//   async create(
//     @Param('bookId') bookId: string,
//     @Body() createChapterDto: CreateChapterDto,
//     @Request() req: any,
//   ) {
//     return this.chaptersService.create(bookId, createChapterDto, req.user.id);
//   }

//   @Get()
//   async findAll(
//     @Param('bookId') bookId: string,
//     @Query() query: ChapterQueryDto,
//     @Request() req: any,
//   ) {
//     return this.chaptersService.findAll(bookId, query, req.user.id);
//   }

//   @Get(':id')
//   async findOne(
//     @Param('bookId') bookId: string,
//     @Param('id') id: string,
//     @Request() req: any,
//   ) {
//     return this.chaptersService.findOne(bookId, id, req.user.id);
//   }

//   @Patch(':id')
//   async update(
//     @Param('bookId') bookId: string,
//     @Param('id') id: string,
//     @Body() updateChapterDto: UpdateChapterDto,
//     @Request() req: any,
//   ) {
//     return this.chaptersService.update(
//       bookId,
//       id,
//       updateChapterDto,
//       req.user.id,
//     );
//   }

//   @Delete(':id')
//   @HttpCode(HttpStatus.NO_CONTENT)
//   async remove(
//     @Param('bookId') bookId: string,
//     @Param('id') id: string,
//     @Request() req: any,
//   ) {
//     await this.chaptersService.remove(bookId, id, req.user.id);
//   }

//   @Post('reorder')
//   async reorderChapters(
//     @Param('bookId') bookId: string,
//     @Body() body: { chapters: { id: string; order: number }[] },
//     @Request() req: any,
//   ) {
//     return this.chaptersService.reorderChapters(
//       bookId,
//       body.chapters,
//       req.user.id,
//     );
//   }
// }
