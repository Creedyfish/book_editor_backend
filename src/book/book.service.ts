import { Injectable } from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { DatabaseService } from 'src/database/database.service';
import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class BookService {
  constructor(private databaseService: DatabaseService) {}

  async create(userId: string, dto: CreateBookDto) {
    const { tagNames = [], ...bookData } = dto;

    // 1. Find existing tags by name
    const existingTags = await this.databaseService.tag.findMany({
      where: {
        name: { in: tagNames },
      },
    });

    // 2. Ensure all tags exist
    const foundTagNames = new Set(existingTags.map((tag) => tag.name));
    const notFoundTags = tagNames.filter((name) => !foundTagNames.has(name));

    if (notFoundTags.length > 0) {
      throw new Error(
        `The following tags do not exist: ${notFoundTags.join(', ')}`,
      );
    }

    // 3. Create book and connect existing tags
    return this.databaseService.book.create({
      data: {
        ...bookData,
        userId,
        tags: {
          create: existingTags.map((tag) => ({
            tag: { connect: { id: tag.id } },
          })),
        },
      },
      include: {
        tags: { include: { tag: true } },
      },
    });
  }

  async findAll(userId: string) {
    return this.databaseService.book.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const book = await this.databaseService.book.findUnique({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async update(id: string, dto: UpdateBookDto) {
    return this.databaseService.book.update({
      where: { id },
      data: { ...dto },
    });
  }

  async remove(id: string) {
    return this.databaseService.book.delete({ where: { id } });
  }
}
