import { Injectable } from '@nestjs/common';
import { User } from 'generated/prisma';
import { DatabaseService } from 'src/database/database.service';
import { BadRequestException } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
@Injectable()
export class UserService {
  constructor(private databaseService: DatabaseService) {}

  async getUser(
    id: string,
  ): Promise<Omit<
    User,
    'refreshToken' | 'password' | 'id' | 'emailVerified'
  > | null> {
    const user = await this.databaseService.user.findUnique({
      where: { id },
      select: { email: true, createdAt: true, updatedAt: true, username: true },
    });
    if (!user) return null;

    return user;
  }

  async usernameUpdate(username: string, userID: string) {
    const existing = await this.databaseService.user.findUnique({
      where: { username },
    });
    if (existing && existing.id !== userID) {
      throw new BadRequestException('Username is already taken');
    }
    return this.databaseService.user.update({
      where: { id: userID },
      data: { username },
    });
  }

  // -------------------------------
  // Public User info
  // -------------------------------

  async getPublicProfile(username: string) {
    const user = await this.databaseService.user.findUnique({
      where: { username },
      select: {
        username: true,
        createdAt: true,
        Book: {
          where: { status: { in: ['PUBLIC', 'PUBLISHED'] } },
          select: { views: true, ratings: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const totalBooks = user.Book.length;
    const totalViews = user.Book.reduce((sum, b) => sum + b.views, 0);
    const averageRating =
      totalBooks > 0
        ? user.Book.reduce((sum, b) => sum + Number(b.ratings), 0) / totalBooks
        : 0;

    return {
      username: user.username,
      joinedAt: user.createdAt,
      stats: { totalBooks, totalViews, averageRating },
    };
  }
}
