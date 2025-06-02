import { Injectable } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { DatabaseService } from 'src/database/database.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { User } from 'generated/prisma';
@Injectable()
export class AuthService {
  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
  ) {}

  async createUser(email: string, password: string) {
    const hashed = await bcrypt.hash(password, 10);
    return this.databaseService.user.create({
      data: {
        email,
        password: hashed,
      },
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.databaseService.user.findUnique({
      where: { email },
    });
    if (!user) return null;

    if (!user.password) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return user;
  }

  async login(user: Pick<User, 'id' | 'email'>) {
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
