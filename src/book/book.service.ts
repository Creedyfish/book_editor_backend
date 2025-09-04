// src/book/services/book.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookProgress } from 'generated/prisma';
import slugify from 'slugify';

@Injectable()
export class BookService {
  constructor(private readonly databaseService: DatabaseService) {}

  // --------------------------------------
  // 🟢 AUTHOR METHODS (Authenticated)
  // --------------------------------------

  async create(userId: string, dto: CreateBookDto) {
    const { tags = [], ...bookData } = dto;

    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    const slug = slugify(bookData.title, {
      lower: true,
      strict: true,
      trim: true,
    });

    const isUnique = await this.databaseService.book.findFirst({
      where: {
        OR: [{ title: bookData.title }, { slug }],
      },
    });

    if (isUnique) {
      throw new ConflictException(`A book with the same title already exists.`);
    }

    if (!user || !user.username) {
      throw new NotFoundException(
        'User needs to have username to register a book',
      );
    }

    const existingTags = await this.databaseService.tag.findMany({
      where: { name: { in: tags } },
    });

    const foundTagNames = new Set(existingTags.map((tag) => tag.name));
    const notFoundTags = tags.filter((name) => !foundTagNames.has(name));

    if (notFoundTags.length > 0) {
      throw new Error(`Tags not found: ${notFoundTags.join(', ')}`);
    }

    const book = await this.databaseService.book.create({
      data: {
        ...bookData,
        slug: slug,
        userId,
        tags: {
          create: existingTags.map((tag) => ({
            tagId: tag.id,
          })),
        },
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return book;
  }

  // async findAll(userId: string, page = 1, limit = 20) {
  //   const skip = (page - 1) * limit;

  //   const [books, total] = await this.databaseService.$transaction([
  //     this.databaseService.book.findMany({
  //       where: { userId },
  //       select: {
  //         id: true,
  //         slug: true,
  //         title: true,
  //         description: true,
  //         status: true,
  //         progress: true,
  //         coverImage: true,
  //         bannerImage: true,
  //         createdAt: true,
  //         updatedAt: true,
  //         tags: { select: { tag: { select: { name: true } } } },
  //         _count: { select: { chapters: true } },
  //       },
  //       orderBy: { createdAt: 'desc' },
  //       skip,
  //       take: limit,
  //     }),
  //     this.databaseService.book.count({ where: { userId } }),
  //   ]);

  //   const results = books.map((book) => ({
  //     id: book.id,
  //     slug: book.slug,
  //     title: book.title,
  //     description: book.description,
  //     status: book.status,
  //     progress: book.progress,
  //     coverImage: book.coverImage,
  //     bannerImage: book.bannerImage,
  //     createdAt: book.createdAt,
  //     updatedAt: book.updatedAt,
  //     tags: (book.tags || []).map((bt) => bt.tag.name),
  //     chapterCount: book._count?.chapters ?? 0, // <-- use this
  //   }));

  //   return {
  //     data: results,
  //     meta: {
  //       total,
  //       page,
  //       limit,
  //       totalPages: Math.ceil(total / limit),
  //     },
  //   };
  // }
  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [books, total] = await this.databaseService.$transaction([
      this.databaseService.book.findMany({
        where: { userId },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          status: true,
          progress: true,
          coverImage: true,
          bannerImage: true,
          views: true, // Include views
          ratings: true, // Include ratings
          createdAt: true,
          updatedAt: true,
          tags: { select: { tag: { select: { name: true } } } },
          _count: { select: { chapters: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.book.count({ where: { userId } }),
    ]);

    const results = books.map((book) => ({
      id: book.id,
      slug: book.slug,
      title: book.title,
      description: book.description,
      status: book.status,
      progress: book.progress,
      coverImage: book.coverImage,
      bannerImage: book.bannerImage,
      views: book.views, // Include views in response
      ratings: book.ratings, // Include ratings in response
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      tags: (book.tags || []).map((bt) => bt.tag.name),
      chapterCount: book._count?.chapters ?? 0,
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

  // async findOne(id: string, userId: string) {
  //   const book = await this.databaseService.book.findUnique({
  //     where: { id },
  //     include: {
  //       tags: { include: { tag: true } },
  //       user: { select: { username: true } }, // add username
  //       _count: { select: { chapters: true } }, // add chapter count
  //     },
  //   });

  //   if (!book) throw new NotFoundException('Book not found');

  //   const isOwner = book.userId === userId;

  //   if (!isOwner) {
  //     throw new ForbiddenException('Book not found');
  //   }

  //   return {
  //     ...book,
  //     tags: book.tags.map((bt) => bt.tag.name),
  //     chapterCount: book._count.chapters, // flatten if needed
  //   };
  // }
  async findOne(id: string, userId: string) {
    const book = await this.databaseService.book.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        user: { select: { username: true } },
        _count: { select: { chapters: true } },
      },
    });

    if (!book) throw new NotFoundException('Book not found');

    const isOwner = book.userId === userId;

    if (!isOwner) {
      throw new ForbiddenException('Book not found');
    }

    return {
      ...book,
      tags: book.tags.map((bt) => bt.tag.name),
      chapterCount: book._count.chapters,
    };
  }

  async update(id: string, dto: UpdateBookDto) {
    const { tags = [], ...bookData } = dto;

    // Optional: check for unique title
    if (bookData.title) {
      const isDuplicate = await this.databaseService.book.findFirst({
        where: {
          title: bookData.title,
          NOT: { id },
        },
      });

      if (isDuplicate) {
        throw new ConflictException(
          `A book with the same title already exists.`,
        );
      }
    }

    // Only process tags if they are actually provided in the DTO
    if (tags.length > 0) {
      const existingTags = await this.databaseService.tag.findMany({
        where: { name: { in: tags } },
      });

      const foundTagNames = new Set(existingTags.map((tag) => tag.name));
      const notFoundTags = tags.filter((name) => !foundTagNames.has(name));

      if (notFoundTags.length > 0) {
        throw new Error(`Tags not found: ${notFoundTags.join(', ')}`);
      }

      const [_, updatedBook] = await this.databaseService.$transaction([
        this.databaseService.bookTag.deleteMany({
          where: { bookId: id },
        }),

        this.databaseService.book.update({
          where: { id },
          data: {
            ...bookData,
            tags: {
              create: existingTags.map((tag) => ({
                tagId: tag.id,
              })),
            },
          },
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
          },
        }),
      ]);

      return updatedBook;
    } else {
      // If no tags provided, just update the book data without touching tags
      const updatedBook = await this.databaseService.book.update({
        where: { id },
        data: bookData,
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });

      return updatedBook;
    }
  }

  async remove(id: string) {
    return this.databaseService.book.delete({ where: { id } });
  }

  // --------------------------------------
  // 🌍 PUBLIC METHODS (Readers)
  // --------------------------------------

  // async getPublicBookBySlug(slug: string) {
  //   const book = await this.databaseService.book.findFirst({
  //     where: {
  //       slug,
  //       status: {
  //         in: ['PUBLIC', 'PUBLISHED'],
  //       },
  //     },
  //     select: {
  //       title: true,
  //       slug: true,
  //       description: true,
  //       progress: true,
  //       coverImage: true,
  //       bannerImage: true,
  //       updatedAt: true,
  //       tags: {
  //         select: {
  //           tag: {
  //             select: {
  //               id: true,
  //               name: true,
  //             },
  //           },
  //         },
  //       },
  //       user: {
  //         select: { username: true },
  //       },
  //       _count: {
  //         select: { chapters: true },
  //       },
  //     },
  //   });

  //   if (!book) return null;

  //   return {
  //     title: book.title,
  //     slug: book.slug,
  //     description: book.description,
  //     progress: book.progress,
  //     coverImage: book.coverImage,
  //     bannerImage: book.bannerImage,
  //     updatedAt: book.updatedAt.toISOString(),
  //     authorName: book.user.username,
  //     tags: book.tags.map((bt) => bt.tag.name),
  //     chapterCount: book._count.chapters,
  //   };
  // }

  async getPublicBookBySlug(slug: string) {
    const book = await this.databaseService.book.findFirst({
      where: {
        slug,
        status: {
          in: ['PUBLIC', 'PUBLISHED'],
        },
      },
      select: {
        title: true,
        slug: true,
        description: true,
        progress: true,
        coverImage: true,
        bannerImage: true,
        views: true, // Include views
        ratings: true, // Include ratings
        updatedAt: true,
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: { username: true },
        },
        _count: {
          select: { chapters: true },
        },
      },
    });

    if (!book) return null;

    return {
      title: book.title,
      slug: book.slug,
      description: book.description,
      progress: book.progress,
      coverImage: book.coverImage,
      bannerImage: book.bannerImage,
      views: book.views, // Include views in response
      ratings: book.ratings, // Include ratings in response
      updatedAt: book.updatedAt.toISOString(),
      authorName: book.user.username,
      tags: book.tags.map((bt) => bt.tag.name),
      chapterCount: book._count.chapters,
    };
  }

  // async findAllVisibleByUser(username: string, page = 1, limit = 10) {
  //   const skip = (page - 1) * limit;

  //   const user = await this.databaseService.user.findUnique({
  //     where: { username },
  //     select: { id: true },
  //   });

  //   if (!user) throw new NotFoundException('User not found');

  //   const [books, total] = await this.databaseService.$transaction([
  //     this.databaseService.book.findMany({
  //       where: {
  //         userId: user.id,
  //         status: { in: ['PUBLIC', 'PUBLISHED'] },
  //       },
  //       include: {
  //         tags: {
  //           include: {
  //             tag: true,
  //           },
  //         },
  //       },
  //       orderBy: { createdAt: 'desc' },
  //       skip,
  //       take: limit,
  //     }),
  //     this.databaseService.book.count({
  //       where: {
  //         userId: user.id,
  //         status: { in: ['PUBLIC', 'PUBLISHED'] },
  //       },
  //     }),
  //   ]);

  //   return {
  //     data: books.map((book) => ({
  //       id: book.id,
  //       title: book.title,
  //       description: book.description,
  //       progress: book.progress,
  //       coverImage: book.coverImage,
  //       bannerImage: book.bannerImage,
  //       createdAt: book.createdAt,
  //       updatedAt: book.updatedAt,
  //       tags: book.tags.map((bt) => bt.tag.name),
  //     })),
  //     meta: {
  //       total,
  //       page,
  //       limit,
  //       totalPages: Math.ceil(total / limit),
  //     },
  //   };
  // }
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
          status: { in: ['PUBLIC', 'PUBLISHED'] },
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
          status: { in: ['PUBLIC', 'PUBLISHED'] },
        },
      }),
    ]);

    return {
      data: books.map((book) => ({
        title: book.title,
        description: book.description,
        progress: book.progress,
        coverImage: book.coverImage,
        bannerImage: book.bannerImage,
        views: book.views, // Include views in response
        ratings: book.ratings, // Include ratings in response
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        tags: book.tags.map((bt) => bt.tag.name),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // async browse(query: {
  //   search?: string;
  //   tags?: string[];
  //   excludeTags?: string[];
  //   progress?: BookProgress;
  //   page?: number;
  //   limit?: number;
  // }) {
  //   const {
  //     search = '',
  //     tags = [],
  //     excludeTags = [],
  //     progress,
  //     page = 1,
  //     limit = 10,
  //   } = query;

  //   const skip = (page - 1) * limit;

  //   const where: any = {
  //     status: { in: ['PUBLIC', 'PUBLISHED'] },
  //     title: { contains: search, mode: 'insensitive' },
  //   };

  //   if (progress) {
  //     where.progress = progress;
  //   }

  //   // Include books that have ANY of the specified tags
  //   if (tags.length > 0) {
  //     where.tags = {
  //       some: {
  //         tag: {
  //           name: { in: tags },
  //         },
  //       },
  //     };
  //   }

  //   // Exclude books that have ANY of the excluded tags
  //   if (excludeTags.length > 0) {
  //     where.AND = where.AND || [];
  //     where.AND.push({
  //       tags: {
  //         none: {
  //           tag: {
  //             name: { in: excludeTags },
  //           },
  //         },
  //       },
  //     });
  //   }

  //   const [books, total] = await this.databaseService.$transaction([
  //     this.databaseService.book.findMany({
  //       where,
  //       include: {
  //         tags: { include: { tag: true } },
  //         user: { select: { username: true } },
  //         _count: { select: { chapters: true } },
  //       },
  //       orderBy: { createdAt: 'desc' },
  //       skip,
  //       take: limit,
  //     }),
  //     this.databaseService.book.count({ where }),
  //   ]);

  //   return {
  //     data: books.map((book) => ({
  //       title: book.title,
  //       description: book.description,
  //       progress: book.progress,
  //       coverImage: book.coverImage,
  //       bannerImage: book.bannerImage,
  //       createdAt: book.createdAt,
  //       updatedAt: book.updatedAt,
  //       authorName: book.user.username,
  //       tags: book.tags.map((bt) => bt.tag.name),
  //       slug: book.slug,
  //       chapterCount: book._count?.chapters ?? 0,
  //     })),
  //     meta: {
  //       total,
  //       page,
  //       limit,
  //       totalPages: Math.ceil(total / limit),
  //     },
  //   };
  // }
  async browse(query: {
    search?: string;
    tags?: string[];
    excludeTags?: string[];
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
      status: { in: ['PUBLIC', 'PUBLISHED'] },
      title: { contains: search, mode: 'insensitive' },
    };

    if (progress) {
      where.progress = progress;
    }

    // Include books that have ANY of the specified tags
    if (tags.length > 0) {
      where.tags = {
        some: {
          tag: {
            name: { in: tags },
          },
        },
      };
    }

    // Exclude books that have ANY of the excluded tags
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
        include: {
          tags: { include: { tag: true } },
          user: { select: { username: true } },
          _count: { select: { chapters: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.book.count({ where }),
    ]);

    return {
      data: books.map((book) => ({
        title: book.title,
        description: book.description,
        progress: book.progress,
        coverImage: book.coverImage,
        bannerImage: book.bannerImage,
        views: book.views, // Include views in response
        ratings: book.ratings, // Include ratings in response
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        authorName: book.user.username,
        tags: book.tags.map((bt) => bt.tag.name),
        slug: book.slug,
        chapterCount: book._count?.chapters ?? 0,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFeaturedBooks(limit: number) {
    const books = await this.databaseService.book.findMany({
      where: {
        status: {
          in: ['PUBLIC', 'PUBLISHED'], // only visible books
        },
      },
      orderBy: [{ ratings: 'desc' }, { views: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      select: {
        title: true,
        slug: true,
        description: true,
        progress: true,
        coverImage: true,
        bannerImage: true,
        views: true,
        ratings: true,
        updatedAt: true,
        user: {
          select: { username: true },
        },
        tags: {
          select: {
            tag: {
              select: {
                name: true,
              },
            },
          },
        },
        _count: {
          select: { chapters: true },
        },
      },
    });

    // transform nested tags into string array
    return books.map((book) => ({
      ...book,
      tags: book.tags.map((bt) => bt.tag.name),
    }));
  }

  async getFeaturedPopularBooks(limit: number) {
    const books = await this.databaseService.book.findMany({
      where: {
        status: {
          in: ['PUBLIC', 'PUBLISHED'],
        },
      },
      orderBy: [
        { views: 'desc' }, // top viewed first
        { ratings: 'desc' }, // break ties with ratings
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        progress: true,
        coverImage: true,
        bannerImage: true,
        views: true,
        ratings: true,
        updatedAt: true,
        user: {
          select: { username: true },
        },
        tags: {
          select: {
            tag: {
              select: { name: true },
            },
          },
        },
        _count: {
          select: { chapters: true },
        },
      },
    });

    return books.map((book) => ({
      ...book,
      tags: book.tags.map((bt) => bt.tag.name),
    }));
  }

  async getFeaturedRisingStars(limit: number) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const books = await this.databaseService.book.findMany({
      where: {
        status: {
          in: ['PUBLIC', 'PUBLISHED'],
        },
        createdAt: {
          gte: oneMonthAgo, // only books created within last month
        },
      },
      orderBy: [{ views: 'desc' }, { ratings: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        progress: true,
        coverImage: true,
        bannerImage: true,
        views: true,
        ratings: true,
        createdAt: true,
        user: {
          select: { username: true },
        },
        tags: {
          select: {
            tag: {
              select: { name: true },
            },
          },
        },
        _count: {
          select: { chapters: true },
        },
      },
    });

    return books.map((book) => ({
      ...book,
      tags: book.tags.map((bt) => bt.tag.name),
    }));
  }
}
