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
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChapterService } from './chapter.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ChapterQueryDto } from './dto/query-chapter.dto';

// chapters.controller.ts

@Controller('books/:slug/chapters')
export class PublicChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Get()
  findAll(
    @Param('slug') slug: string,
    @Query() query: ChapterQueryDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.chapterService.findAllBySlug(slug, query, userId);
  }

  @Get(':chapterId')
  findOne(
    @Param('slug') slug: string,
    @Param('chapterId') chapterId: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.chapterService.findOneBySlug(slug, chapterId, userId);
  }

  @Get('order/:order')
  findByOrder(
    @Param('slug') slug: string,
    @Param('order', ParseIntPipe) order: number,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.chapterService.findOneBySlugAndOrder(slug, order, userId);
  }
}

@Controller('dashboard/books/:bookId/chapters')
@UseGuards(AuthGuard('jwt'))
export class DashboardChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  // const req.user = { id: '5302be7d-1b9e-43c0-a9cc-214cc9fa0e20' };

  @Post()
  create(
    @Param('bookId') bookId: string,
    @Body() dto: CreateChapterDto,
    @Request() req: any,
  ) {
    // const req = {
    //   user: {
    //     id: '5302be7d-1b9e-43c0-a9cc-214cc9fa0e20',
    //   },
    // };
    return this.chapterService.create(bookId, dto, req.user.id);
  }

  @Get()
  findAll(
    @Param('bookId') bookId: string,
    @Query() query: ChapterQueryDto,
    @Request() req: any,
  ) {
    return this.chapterService.findAll(bookId, query, req.user.id);
  }

  @Get(':chapterId')
  findOne(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Request() req: any,
  ) {
    return this.chapterService.findOne(bookId, chapterId, req.user.id);
  }

  @Patch(':chapterId')
  update(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateChapterDto,
    @Request() req: any,
  ) {
    return this.chapterService.update(bookId, chapterId, dto, req.user.id);
  }

  @Delete(':chapterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Request() req: any,
  ) {
    return this.chapterService.remove(bookId, chapterId, req.user.id);
  }

  @Post('reorder')
  reorder(
    @Param('bookId') bookId: string,
    @Body() body: { chapters: { id: string; order: number }[] },
    @Request() req: any,
  ) {
    return this.chapterService.reorderChapters(
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
