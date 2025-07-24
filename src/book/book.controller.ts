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

@Controller('books')
export class BookController {
  private readonly DEFAULT_COVER_URL = process.env.DEFAULT_BOOK_COVER_URL;
  private readonly DEFAULT_BANNER_URL = process.env.DEFAULT_BOOK_BANNER_URL;
  constructor(
    private readonly bookService: BookService,
    private uploadService: UploadService,
  ) {}

  // --------------------------------------
  // 🌍 PUBLIC ROUTES (Readers)
  // --------------------------------------

  @Get('author/:username')
  findAllVisibleByUser(
    @Param('username') username: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.bookService.findAllVisibleByUser(username, page, limit);
  }

  @Get('browse')
  browse(
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

  // --------------------------------------
  // 🟢 AUTHOR ROUTES (Authenticated)
  // --------------------------------------

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

        // Use uploaded URLs if provided, otherwise keep defaults
        coverUrl = uploadResults.coverUrl || this.DEFAULT_COVER_URL;
        bannerUrl = uploadResults.bannerUrl || this.DEFAULT_BANNER_URL;
      }

      // Update book with asset URLs (always set both cover and banner)
      const updatedBook = await this.bookService.update(book.id, {
        coverImage: coverUrl,
        bannerImage: bannerUrl,
      });

      return { ...updatedBook };
    } catch (error) {
      // If book creation fails after upload, we need to clean up uploaded files
      if (files.cover || files.banner) {
        // This would require the upload service to track temporary uploads
        // For now, we'll let the error propagate
      }
      throw error;
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll(
    @Req() req,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    const userId = req.user.id;
    return this.bookService.findAll(userId, page, limit);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookService.findOne(id);
  }

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

    try {
      // Get existing book to check ownership and get current asset URLs
      const existingBook = await this.bookService.findOne(id);

      // Verify ownership (you might want to add this check to the service)
      if (existingBook.userId !== userId) {
        throw new BadRequestException('You can only update your own books');
      }

      // Handle file uploads if provided
      if (files.cover || files.banner) {
        const uploadResults = await this.uploadService.updateBookAssets(
          userId,
          id,
          existingBook.coverImage ?? undefined,
          existingBook.bannerImage ?? undefined,
          files.cover?.[0],
          files.banner?.[0],
        );

        // Merge upload results with DTO
        const updateData = {
          ...dto,
          ...(uploadResults.coverUrl && { coverImage: uploadResults.coverUrl }),
          ...(uploadResults.bannerUrl && {
            bannerImage: uploadResults.bannerUrl,
          }),
        };

        return this.bookService.update(id, updateData);
      }

      // Update without files
      return this.bookService.update(id, dto);
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.id;

    try {
      // Get book details before deletion to access asset URLs
      const book = await this.bookService.findOne(id);

      // Verify ownership
      if (book.userId !== userId) {
        throw new BadRequestException('You can only delete your own books');
      }

      // Delete the book from database
      await this.bookService.remove(id);

      // Clean up associated assets
      if (book.coverImage || book.bannerImage) {
        await this.uploadService.deleteBookAssets(
          book.coverImage ?? undefined,
          book.bannerImage ?? undefined,
        );
      }

      return { message: 'Book and associated assets deleted successfully' };
    } catch (error) {
      throw error;
    }
  }
}
