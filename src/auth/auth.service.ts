import { Injectable } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from 'generated/prisma';
import { randomUUID, createHash } from 'crypto';
import { MailService } from 'src/mail/mail.service';
@Injectable()
export class AuthService {
  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
  ) {}

  private generateCode(length = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createUser(email: string, password: string) {
    const existingUser = await this.databaseService.user.findUnique({
      where: { email },
      include: { accounts: true },
    });

    if (existingUser) {
      // Optional: Provide a smart error
      if (existingUser.accounts.some((acc) => acc.provider === 'google')) {
        throw new ForbiddenException('This email is already registered.');
      }

      throw new ForbiddenException('Email is already in use.');
    }

    const hashed = await bcrypt.hash(password, 10);
    return this.databaseService.user.create({
      data: {
        email,
        password: hashed,
      },
    });
  }

  async createEmailVerificationCode(userId: string): Promise<string> {
    const code = this.generateCode();
    const hashedCode = await bcrypt.hash(code, 10);
    await this.databaseService.emailVerificationCode.create({
      data: {
        userId,
        code: hashedCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    console.log(code);
    return code;
  }

  async UserCodeVerification(code: string, email: string) {
    const user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new ForbiddenException();
    }

    const record = await this.databaseService.emailVerificationCode.findFirst({
      where: {
        userId: user.id,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!record) {
      throw new ForbiddenException('Verification code not found or expired.');
    }

    const isMatch = await bcrypt.compare(code, record.code);
    if (!isMatch) {
      throw new ForbiddenException('Invalid verification code.');
    }

    await this.databaseService.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    await this.databaseService.emailVerificationCode.delete({
      where: { id: record.id },
    });
    console.log('user Verified');
  }

  async validateUser(email: string, password: string) {
    const user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) return null;

    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return user;
  }

  async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '5d',
      jwtid: randomUUID(),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async login(user: Pick<User, 'id' | 'email'>) {
    const tokens = await this.generateTokens(user.id, user.email);
    await this.createSession(user.id, tokens.refreshToken);

    return tokens;
  }

  async createSession(
    userId: string,
    refreshToken: string,
    // userAgent?: string,
    // ipAddress?: string,
  ) {
    const hashedToken = createHash('sha256').update(refreshToken).digest('hex');

    // Optional: customize expiration policy
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5); // 5 days

    await this.databaseService.session.create({
      data: {
        userId,
        refreshToken: hashedToken,
        // userAgent,
        // ipAddress,
        expiresAt,
      },
    });
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const hashedToken = createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      const session = await this.databaseService.session.findFirst({
        where: {
          userId: payload.sub,
          refreshToken: hashedToken,
          revoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: { user: true },
      });

      if (!session || !session.user) {
        throw new ForbiddenException('Invalid or expired session');
      }
      await this.databaseService.session.update({
        where: { id: session.id },
        data: { revoked: true },
      });
      const newTokens = await this.generateTokens(
        session.user.id,
        session.user.email,
      );
      await this.createSession(session.user.id, newTokens.refreshToken);

      return newTokens;
    } catch (err) {
      throw new UnauthorizedException('Access denied');
    }
  }

  async logout(refreshToken: string) {
    const hashed = createHash('sha256').update(refreshToken).digest('hex');
    await this.databaseService.session.updateMany({
      where: { refreshToken: hashed },
      data: { revoked: true },
    });
    return;
  }
}
