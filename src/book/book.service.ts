// src/book/services/book.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookProgress } from 'generated/prisma';
@Injectable()
export class BookService {
  constructor(private readonly databaseService: DatabaseService) {}

  // --------------------------------------
  // 🟢 AUTHOR METHODS (Authenticated)
  // --------------------------------------

  async create(userId: string, dto: CreateBookDto) {
    const { tagNames = [], ...bookData } = dto;

    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (!user || !user.username) {
      throw new NotFoundException(
        'User needs to have username to register a book',
      );
    }

    const existingTags = await this.databaseService.tag.findMany({
      where: { name: { in: tagNames } },
    });

    const foundTagNames = new Set(existingTags.map((tag) => tag.name));
    const notFoundTags = tagNames.filter((name) => !foundTagNames.has(name));

    if (notFoundTags.length > 0) {
      throw new Error(`Tags not found: ${notFoundTags.join(', ')}`);
    }

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
      include: { tags: { include: { tag: true } } },
    });
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [books, total] = await this.databaseService.$transaction([
      this.databaseService.book.findMany({
        where: { userId },
        include: { tags: { include: { tag: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.book.count({ where: { userId } }),
    ]);

    const results = books.map((book) => ({
      id: book.id,
      title: book.title,
      description: book.description,
      status: book.status,
      progress: book.progress,
      coverImage: book.coverImage,
      bannerImage: book.bannerImage,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      tagNames: book.tags.map((bt) => bt.tag.name),
    }));

    return {
      data: results,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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

  // --------------------------------------
  // 🌍 PUBLIC METHODS (Readers)
  // --------------------------------------

  async findAllVisibleByUser(username: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const user = await this.databaseService.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const [books, total] = await this.databaseService.$transaction([
      this.databaseService.book.findMany({
        where: {
          userId: user.id,
          status: 'PUBLIC',
        },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.book.count({
        where: {
          userId: user.id,
          status: 'PUBLIC',
        },
      }),
    ]);

    return {
      data: books.map((book) => ({
        id: book.id,
        title: book.title,
        description: book.description,
        progress: book.progress,
        coverImage: book.coverImage,
        bannerImage: book.bannerImage,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        tagNames: book.tags.map((bt) => bt.tag.name),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async browse(query: {
    search?: string;
    tags?: string[]; // <-- updated
    excludeTags?: string[]; // <-- new
    progress?: BookProgress;
    page?: number;
    limit?: number;
  }) {
    const {
      search = '',
      tags = [],
      excludeTags = [],
      progress,
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      status: 'PUBLIC',
      title: { contains: search, mode: 'insensitive' },
    };

    if (progress) {
      where.progress = progress;
    }

    // ✅ Include books that have ANY of the specified tags
    if (tags.length > 0) {
      where.tags = {
        some: {
          tag: {
            name: { in: tags },
          },
        },
      };
    }

    // ❌ Exclude books that have ANY of the excluded tags
    if (excludeTags.length > 0) {
      where.AND = where.AND || [];
      where.AND.push({
        tags: {
          none: {
            tag: {
              name: { in: excludeTags },
            },
          },
        },
      });
    }

    const [books, total] = await this.databaseService.$transaction([
      this.databaseService.book.findMany({
        where,
        include: { tags: { include: { tag: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.book.count({ where }),
    ]);

    return {
      data: books.map((book) => ({
        id: book.id,
        title: book.title,
        description: book.description,
        progress: book.progress,
        coverImage: book.coverImage,
        bannerImage: book.bannerImage,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        tagNames: book.tags.map((bt) => bt.tag.name),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
