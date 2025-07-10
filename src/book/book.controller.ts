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
} from '@nestjs/common';
import { BookService } from './book.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { AuthGuard } from '@nestjs/passport';
@Controller('book')
@UseGuards(AuthGuard('jwt'))
export class BookController {
  constructor(private readonly bookService: BookService) {}

  @Post()
  create(@Body() dto: CreateBookDto, @Req() req) {
    const userId = req.user.id;
    return this.bookService.create(userId, dto);
  }

  @Get()
  findAll(@Req() req) {
    const userId = req.user.id;
    return this.bookService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBookDto) {
    return this.bookService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookService.remove(id);
  }
}
