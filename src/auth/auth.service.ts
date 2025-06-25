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
  private generateCode(length = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  // -------------------------------
  // User Registration & Verification
  // -------------------------------

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

    return code;
  }

  // async resendEmailVerificationCode(email: string) {
  //   const user = await this.databaseService.user.findUnique({
  //     where: { email },
  //   });

  //   // Don't reveal if email exists (security best practice)
  //   if (!user) {
  //     // Still return success to prevent email enumeration
  //     return;
  //   }

  //   // If already verified, don't send code but don't reveal this info
  //   if (user.emailVerified) {
  //     return;
  //   }

  //   const code = this.generateCode();
  //   const hashedCode = await bcrypt.hash(code, 10);

  //   // Delete any existing verification codes for this user
  //   await this.databaseService.emailVerificationCode.deleteMany({
  //     where: { userId: user.id },
  //   });

  //   // Create new verification code
  //   await this.databaseService.emailVerificationCode.create({
  //     data: {
  //       userId: user.id,
  //       code: hashedCode,
  //       expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  //     },
  //   });

  //   // Send the email with the plain code
  //   return { email, code };
  // }

  async verifyUserEmailCode(code: string, email: string) {
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

    await this.databaseService.emailVerificationCode.deleteMany({
      where: { userId: user.id },
    });
    return user;
  }

  async resendEmailVerificationCode(email: string) {
    const user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // ✅ Check if a *non-expired* code exists
    const existingCode =
      await this.databaseService.emailVerificationCode.findFirst({
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

    if (existingCode) {
      // ✅ Prevent abuse: don’t resend if a valid code was recently sent
      const timeSinceLastSent =
        Date.now() - new Date(existingCode.createdAt).getTime();
      const RESEND_TIMEOUT = 60 * 1000; // 1 minute
      if (timeSinceLastSent < RESEND_TIMEOUT) {
        throw new ForbiddenException(
          'Please wait before requesting another code.',
        );
      }

      // 🧹 Clean up old code before issuing a new one
      await this.databaseService.emailVerificationCode.deleteMany({
        where: { userId: user.id },
      });
    }

    // ✅ Create new code
    const code = await this.createEmailVerificationCode(user.id);

    // ✅ Send new email
    await this.mailService.sendVerificationCode(user.email, code);
  }

  // -------------------------------
  // User Authentication
  // -------------------------------

  async verifyTurnstileToken(token: string) {
    const secret = process.env.TURNSTILE_SECRET_KEY || '';

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret,
          response: token,
        }),
      },
    );

    const data = await response.json();

    if (!data.success) {
      throw new UnauthorizedException('Turnstile verification failed');
    }

    return true;
  }

  async validateUser(email: string, password: string) {
    const user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return user;
  }

  // -------------------------------
  // Token Generation & Session Management
  // -------------------------------

  async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
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
