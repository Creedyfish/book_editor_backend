// src/chapters/chapters.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { DatabaseService } from 'src/database/database.service';
@Injectable()
export class ChapterService {
  constructor(private databaseService: DatabaseService) {}

  async create(
    bookId: string,
    createChapterDto: CreateChapterDto,
    userId: string,
  ) {
    return this.databaseService.$transaction(async (tx) => {
      // Step 1: Verify book ownership
      const book = await tx.book.findUnique({
        where: { id: bookId },
        select: { id: true, userId: true },
      });

      if (!book) {
        throw new NotFoundException('Book not found');
      }

      if (book.userId !== userId) {
        throw new ForbiddenException(
          'You can only add chapters to your own books',
        );
      }

      // Step 2: Check for duplicate chapter title
      const existingChapter = await tx.chapter.findUnique({
        where: {
          bookId_title: {
            bookId,
            title: createChapterDto.title,
          },
        },
      });

      if (existingChapter) {
        throw new ConflictException(
          'A chapter with this title already exists in this book',
        );
      }

      // Step 3: Safely calculate next order
      const lastChapter = await tx.chapter.findFirst({
        where: { bookId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const nextOrder = lastChapter ? lastChapter.order + 1 : 1;

      // Step 4: Compute word count if needed
      const wordCount = this.calculateWordCount(createChapterDto.content);

      // Step 5: Create chapter with computed order
      return tx.chapter.create({
        data: {
          ...createChapterDto,
          bookId,
          wordCount,
          order: nextOrder,
        },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              userId: true,
            },
          },
        },
      });
    });
  }

  async findAll(
    bookId: string,
    query: { page: number; limit: number },
    userId?: string,
  ) {
    const book = await this.databaseService.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    const canAccess = this.canAccessBook(book, userId);
    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this book');
    }

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where = { bookId };

    const [chapters, total] = await Promise.all([
      this.databaseService.chapter.findMany({
        where,
        orderBy: { order: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          wordCount: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { comments: true },
          },
        },
      }),
      this.databaseService.chapter.count({ where }),
    ]);

    return {
      chapters,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(bookId: string, chapterId: string, userId?: string) {
    const chapter = await this.databaseService.chapter.findFirst({
      where: {
        id: chapterId,
        bookId,
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            userId: true,
            status: true,
            slug: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    // Check if user can access this chapter
    const canAccess = this.canAccessBook(chapter.book, userId);
    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this chapter');
    }

    return chapter;
  }

  async update(
    bookId: string,
    chapterId: string,
    updateChapterDto: UpdateChapterDto,
    userId: string,
  ) {
    const chapter = await this.databaseService.chapter.findFirst({
      where: {
        id: chapterId,
        bookId,
      },
      include: {
        book: {
          select: { userId: true },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    if (chapter.book.userId !== userId) {
      throw new ForbiddenException(
        'You can only update chapters in your own books',
      );
    }

    // Check for title conflicts if title is being updated
    if (updateChapterDto.title && updateChapterDto.title !== chapter.title) {
      const existingChapter = await this.databaseService.chapter.findUnique({
        where: {
          bookId_title: {
            bookId,
            title: updateChapterDto.title,
          },
        },
      });

      if (existingChapter) {
        throw new ConflictException(
          'A chapter with this title already exists in this book',
        );
      }
    }

    // Calculate word count if content is being updated
    const wordCount = updateChapterDto.content
      ? this.calculateWordCount(updateChapterDto.content)
      : undefined;

    return this.databaseService.chapter.update({
      where: { id: chapterId },
      data: {
        ...updateChapterDto,
        ...(wordCount !== undefined && { wordCount }),
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            userId: true,
          },
        },
      },
    });
  }

  async remove(bookId: string, chapterId: string, userId: string) {
    return this.databaseService.$transaction(async (tx) => {
      const chapter = await tx.chapter.findFirst({
        where: {
          id: chapterId,
          bookId,
        },
        include: {
          book: {
            select: { userId: true },
          },
        },
      });

      if (!chapter) {
        throw new NotFoundException('Chapter not found');
      }

      if (chapter.book.userId !== userId) {
        throw new ForbiddenException(
          'You can only delete chapters from your own books',
        );
      }

      // Delete the chapter
      await tx.chapter.delete({
        where: { id: chapterId },
      });

      // Get remaining chapters in order
      const remainingChapters = await tx.chapter.findMany({
        where: { bookId },
        orderBy: { order: 'asc' },
        select: { id: true },
      });

      // Reassign order starting from 1
      await Promise.all(
        remainingChapters.map((ch, index) =>
          tx.chapter.update({
            where: { id: ch.id },
            data: { order: index + 1 },
          }),
        ),
      );

      return { success: true };
    });
  }

  async reorderChapters(
    bookId: string,
    chapterOrders: { id: string; order: number }[],
    userId: string,
  ) {
    // Verify book ownership
    const book = await this.databaseService.book.findUnique({
      where: { id: bookId },
      select: { userId: true },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    if (book.userId !== userId) {
      throw new ForbiddenException(
        'You can only reorder chapters in your own books',
      );
    }

    // Update chapter orders in a transaction
    return this.databaseService.$transaction(
      chapterOrders.map(({ id, order }) =>
        this.databaseService.chapter.update({
          where: { id },
          data: { order },
        }),
      ),
    );
  }

  private canAccessBook(
    book: { userId: string; status: string },
    userId?: string,
  ): boolean {
    // Owner can always access
    if (userId && book.userId === userId) {
      return true;
    }

    // // Public books can be accessed by anyone
    if (book.status === 'PUBLIC' || book.status === 'PUBLISHED') {
      return true;
    }

    // Private/Draft books only for owner
    return false;
  }

  private calculateWordCount(content: any): number {
    // This is a simple word count calculation
    // You might need to adjust based on your content structure
    if (typeof content === 'string') {
      return content.split(/\s+/).filter((word) => word.length > 0).length;
    }

    if (typeof content === 'object' && content !== null) {
      const text = JSON.stringify(content);
      return text.split(/\s+/).filter((word) => word.length > 0).length;
    }

    return 0;
  }

  // public

  async findAllBySlug(
    slug: string,
    query: { page: number; limit: number },
    userId?: string,
  ) {
    const book = await this.databaseService.book.findUnique({
      where: { slug },
      select: { id: true, userId: true, status: true },
    });

    if (!book) throw new NotFoundException('Book not found');

    const canAccess = this.canAccessBook(book, userId);
    if (!canAccess) throw new ForbiddenException('Access denied');

    const { chapters, meta } = await this.findAll(book.id, query, userId);

    const publicChapters = chapters.map(({ id, ...rest }) => rest); // remove `id`

    return {
      chapters: publicChapters,
      meta,
    };
  }

  async findOneBySlug(slug: string, chapterId: string, userId?: string) {
    const book = await this.databaseService.book.findUnique({
      where: { slug },
      select: { id: true, userId: true, status: true },
    });

    if (!book) throw new NotFoundException('Book not found');

    const canAccess = this.canAccessBook(book, userId);
    if (!canAccess) throw new ForbiddenException('Access denied');

    const chapter = await this.findOne(book.id, chapterId, userId);

    // Remove sensitive fields before returning
    const {
      id,
      book: { id: bookId, userId: bookUserId, ...restBook },
      ...restChapter
    } = chapter;

    return {
      ...restChapter,
      book: restBook,
    };
  }

  async findOneBySlugAndOrder(slug: string, order: number, userId?: string) {
    const book = await this.databaseService.book.findUnique({
      where: { slug },
      select: { id: true, userId: true, status: true, slug: true, title: true },
    });

    if (!book) throw new NotFoundException('Book not found');

    const canAccess = this.canAccessBook(book, userId);
    if (!canAccess) throw new ForbiddenException('Access denied');

    const chapter = await this.databaseService.chapter.findFirst({
      where: {
        bookId: book.id,
        order,
      },
      include: {
        _count: { select: { comments: true } },
      },
    });

    if (!chapter) throw new NotFoundException('Chapter not found');

    const { id, bookId, ...rest } = chapter;
    return rest;
  }
}
