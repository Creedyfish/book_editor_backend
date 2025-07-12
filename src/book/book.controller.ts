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
} from '@nestjs/common';
import { BookService } from './book.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { AuthGuard } from '@nestjs/passport';
import { BookProgress } from 'generated/prisma';
// import { Public } from '@nestjs/common';

@Controller('books')
export class BookController {
  constructor(private readonly bookService: BookService) {}

  // --------------------------------------
  // 🌍 PUBLIC ROUTES (Readers)
  // --------------------------------------

  @Get('author/:username')
  findAllVisibleByUser(
    @Param('username') username: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.bookService.findAllVisibleByUser(username, +page, +limit);
  }

  @Get('browse')
  browse(
    @Query('search') search?: string,
    @Query('tags') tags?: string | string[],
    @Query('excludeTags') excludeTags?: string | string[],
    @Query('progress') progress?: BookProgress,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
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
      page: +page,
      limit: +limit,
    });
  }

  // --------------------------------------
  // 🟢 AUTHOR ROUTES (Authenticated)
  // --------------------------------------

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() dto: CreateBookDto, @Req() req) {
    const userId = req.user.id;
    return this.bookService.create(userId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll(@Req() req, @Query('page') page = 1, @Query('limit') limit = 10) {
    const userId = req.user.id;
    return this.bookService.findAll(userId, +page, +limit);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBookDto) {
    return this.bookService.update(id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookService.remove(id);
  }
}
