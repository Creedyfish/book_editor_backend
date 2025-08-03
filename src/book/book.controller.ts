// src/book/book.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Put,
  Query,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { BookService } from './book.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../upload/upload.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { AuthGuard } from '@nestjs/passport';
import { BookProgress } from 'generated/prisma';
import { NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
@Controller('books')
export class BookController {
  private readonly DEFAULT_COVER_URL = process.env.DEFAULT_BOOK_COVER_URL;
  private readonly DEFAULT_BANNER_URL = process.env.DEFAULT_BOOK_BANNER_URL;

  constructor(
    private readonly bookService: BookService,
    private uploadService: UploadService,
  ) {}

  // -----------------------------
  // 🌍 PUBLIC ROUTES (Readers)
  // -----------------------------

  // Static first
  @Get('browse')
  async browse(
    @Query('search') search?: string,
    @Query('tags') tags?: string | string[],
    @Query('excludeTags') excludeTags?: string | string[],
    @Query('progress') progress?: BookProgress,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.bookService.browse({
      search,
      tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
      excludeTags: Array.isArray(excludeTags)
        ? excludeTags
        : excludeTags
          ? [excludeTags]
          : [],
      progress,
      page,
      limit,
    });
  }

  @Get('author/:username')
  async findAllVisibleByUser(
    @Param('username') username: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.bookService.findAllVisibleByUser(username, page, limit);
  }

  // Slug before ID to avoid conflict
  @Get(':slug')
  async getPublicBook(@Param('slug') slug: string) {
    const book = await this.bookService.getPublicBookBySlug(slug);
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    return book;
  }

  @Get('slug/:slug/:order')
  async getPublicBookChapter(
    @Param('slug') slug: string,
    @Param('order') order: string, // will convert to number below
  ) {
    const chapter = await this.bookService.getPublicBookChapterByOrder(
      slug,
      Number(order),
    );
    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }
    return chapter;
  }
  // -----------------------------
  // 🟢 AUTHOR ROUTES (Authenticated)
  // -----------------------------

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cover', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ]),
  )
  async create(
    @Body() dto: CreateBookDto,
    @Req() req,
    @UploadedFiles()
    files: { cover?: Express.Multer.File[]; banner?: Express.Multer.File[] },
  ) {
    const username = req.user.username;
    const userId = req.user.id;

    try {
      const book = await this.bookService.create(userId, dto);

      let coverUrl = this.DEFAULT_COVER_URL;
      let bannerUrl = this.DEFAULT_BANNER_URL;

      if (files.cover || files.banner) {
        const uploadResults = await this.uploadService.uploadBookAssets(
          username,
          book.slug,
          files.cover?.[0],
          files.banner?.[0],
        );

        coverUrl = uploadResults.coverUrl || this.DEFAULT_COVER_URL;
        bannerUrl = uploadResults.bannerUrl || this.DEFAULT_BANNER_URL;
      }

      const updatedBook = await this.bookService.update(book.id, {
        coverImage: coverUrl,
        bannerImage: bannerUrl,
      });

      return updatedBook;
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(
    @Req() req,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.bookService.findAll(req.user.id, page, limit);
  }

  @Get('id/:id')
  @UseGuards(AuthGuard('jwt'))
  async findOne(
    @Param('id') id: string,
    @Req() req,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.bookService.findOne(id, req.user.id, page, limit);
  }

  // @UseGuards(AuthGuard('jwt'))
  // @Put(':id')
  // @UseInterceptors(
  //   FileFieldsInterceptor([
  //     { name: 'cover', maxCount: 1 },
  //     { name: 'banner', maxCount: 1 },
  //   ]),
  // )
  // async update(
  //   @Param('id') id: string,
  //   @Body() dto: UpdateBookDto,
  //   @Req() req,
  //   @UploadedFiles()
  //   files: { cover?: Express.Multer.File[]; banner?: Express.Multer.File[] },
  // ) {
  //   const userId = req.user.id;
  //   const username = req.user.username;
  //   const title = dto.title as string;

  //   const existingBook = await this.bookService.findOne(id, userId);
  //   if (existingBook.userId !== userId) {
  //     throw new BadRequestException('You can only update your own books');
  //   }

  //   if (files.cover || files.banner) {
  //     const uploadResults = await this.uploadService.updateBookAssets(
  //       username,
  //       title,
  //       existingBook.coverImage ?? undefined,
  //       existingBook.bannerImage ?? undefined,
  //       files.cover?.[0],
  //       files.banner?.[0],
  //     );

  //     const updateData = {
  //       ...dto,
  //       ...(uploadResults.coverUrl && { coverImage: uploadResults.coverUrl }),
  //       ...(uploadResults.bannerUrl && {
  //         bannerImage: uploadResults.bannerUrl,
  //       }),
  //     };

  //     return this.bookService.update(id, updateData);
  //   }

  //   return this.bookService.update(id, dto);
  // }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cover', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ]),
  )
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBookDto,
    @Req() req,
    @UploadedFiles()
    files: { cover?: Express.Multer.File[]; banner?: Express.Multer.File[] },
  ) {
    const userId = req.user.id;
    const username = req.user.username;

    const existingBook = await this.bookService.findOne(id, userId);
    if (existingBook.userId !== userId) {
      throw new BadRequestException('You can only update your own books');
    }

    const oldSlug = existingBook.slug;
    const newSlug = slugify(dto.title as string, {
      lower: true,
      strict: true,
      trim: true,
    });

    let coverUrl: string | undefined = existingBook.coverImage ?? undefined;
    let bannerUrl: string | undefined = existingBook.bannerImage ?? undefined;

    // 1. Upload new assets first (to old slug folder)
    if (files.cover || files.banner) {
      const uploadResults = await this.uploadService.updateBookAssets(
        username,
        oldSlug, // still old slug!
        existingBook.coverImage ?? undefined,
        existingBook.bannerImage ?? undefined,
        files.cover?.[0],
        files.banner?.[0],
      );

      coverUrl = uploadResults.coverUrl ?? coverUrl;
      bannerUrl = uploadResults.bannerUrl ?? bannerUrl;
    }

    // 2. Rename the folder only after upload is done
    if (oldSlug !== newSlug) {
      await this.uploadService.renameBookAssets(username, oldSlug, newSlug);

      // Fix URLs (replace old slug in path with new slug)
      coverUrl = coverUrl?.replace(oldSlug, newSlug);
      bannerUrl = bannerUrl?.replace(oldSlug, newSlug);
    }

    // 3. Final update
    const updateData = {
      ...dto,
      ...(coverUrl && { coverImage: coverUrl }),
      ...(bannerUrl && { bannerImage: bannerUrl }),
      ...(oldSlug !== newSlug && { slug: newSlug }),
    };

    return this.bookService.update(id, updateData);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;
    const username = req.user.username;

    const book = await this.bookService.findOne(id, userId);
    if (book.userId !== userId) {
      throw new BadRequestException('You can only delete your own books');
    }

    await this.bookService.remove(id);

    await this.uploadService.deleteBookFolder(username, book.slug);

    return { message: 'Book and associated assets deleted successfully' };
  }
}
