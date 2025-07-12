import { Injectable } from '@nestjs/common';
import { User } from 'generated/prisma';
import { DatabaseService } from 'src/database/database.service';

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
}
