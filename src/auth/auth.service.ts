import { Injectable } from '@nestjs/common';
import {
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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
    return this.databaseService.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
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
      return tx.user.create({
        data: {
          email,
          password: hashed,
        },
      });
    });
  }

  async createEmailVerificationCode(userId: string): Promise<string> {
    return this.databaseService.$transaction(async (tx) => {
      const code = this.generateCode();
      const hashedCode = await bcrypt.hash(code, 10);

      await tx.emailVerificationCode.create({
        data: {
          userId,
          code: hashedCode,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      return code;
    });
  }

  async createResetPasswordCode(userId: string): Promise<string> {
    return this.databaseService.$transaction(async (tx) => {
      const code = this.generateCode();
      const hashedCode = await bcrypt.hash(code, 10);

      await tx.passwordResetCode.create({
        data: {
          userId,
          code: hashedCode,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      return code;
    });
  }

  async verifyUserEmailCode(code: string, email: string) {
    return this.databaseService.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new ForbiddenException();
      }

      const record = await tx.emailVerificationCode.findFirst({
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

      // Update user and delete verification codes atomically
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });

      await tx.emailVerificationCode.deleteMany({
        where: { userId: user.id },
      });

      return updatedUser;
    });
  }

  async resendEmailVerificationCode(email: string) {
    return this.databaseService
      .$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { email },
        });

        if (!user) {
          throw new ForbiddenException('User not found');
        }

        // ✅ Check if a *non-expired* code exists
        const existingCode = await tx.emailVerificationCode.findFirst({
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
          // ✅ Prevent abuse: don't resend if a valid code was recently sent
          const timeSinceLastSent =
            Date.now() - new Date(existingCode.createdAt).getTime();
          const RESEND_TIMEOUT = 60 * 1000; // 1 minute
          if (timeSinceLastSent < RESEND_TIMEOUT) {
            throw new ForbiddenException(
              'Please wait before requesting another code.',
            );
          }

          // 🧹 Clean up old code before issuing a new one
          await tx.emailVerificationCode.deleteMany({
            where: { userId: user.id },
          });
        }

        // ✅ Create new code within transaction
        const code = this.generateCode();
        const hashedCode = await bcrypt.hash(code, 10);

        await tx.emailVerificationCode.create({
          data: {
            userId: user.id,
            code: hashedCode,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });

        // ✅ Send new email (this happens after transaction commits)
        // Note: Email sending is moved outside transaction to avoid holding DB connection
        return { user, code };
      })
      .then(async ({ user, code }) => {
        // Send email after successful transaction
        await this.mailService.sendCodeEmail(
          user.email,
          code,
          'email-verification',
        );
      });
  }

  async requestPasswordReset(email: string) {
    return this.databaseService
      .$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { email: email },
          include: { accounts: true }, // Include accounts to check provider
        });

        if (!user) throw new NotFoundException('User not found');

        // Check if user has a Google account (OAuth) and no password
        const hasGoogleAccount = user.accounts.some(
          (acc) => acc.provider === 'google',
        );

        if (hasGoogleAccount && !user.password) {
          throw new ForbiddenException(
            'Password reset is not available for Google accounts. Please sign in with Google.',
          );
        }

        // Optional: Also block if user only has Google account even with a password set
        // Uncomment the lines below if you want stricter behavior
        // if (hasGoogleAccount) {
        //   throw new ForbiddenException('This account uses Google sign-in. Password reset is not available.');
        // }

        const code = this.generateCode();
        const hashedCode = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

        await tx.passwordResetCode.create({
          data: {
            userId: user.id,
            code: hashedCode,
            expiresAt,
          },
        });

        return { user, code };
      })
      .then(async ({ user, code }) => {
        // Send email after successful transaction
        await this.mailService.sendCodeEmail(
          user.email,
          code,
          'password-reset',
        );
        return { message: 'Password reset code sent to your email' };
      });
  }

  async passwordReset(code: string, password: string, email: string) {
    return this.databaseService.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email: email },
      });

      if (!user) {
        throw new ForbiddenException();
      }

      const record = await tx.passwordResetCode.findFirst({
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

      const hashed = await bcrypt.hash(password, 10);

      // Update password and delete reset codes atomically
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashed },
      });

      await tx.passwordResetCode.deleteMany({
        where: { userId: user.id },
      });

      return { message: 'Password has been reset' };
    });
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
      throw new BadRequestException('Something went wrong please try again');
    }

    return true;
  }

  async validateUser(email: string, password: string) {
    // Read-only operation, no transaction needed
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

  async generateTokens(userId: string, email: string, username?: string) {
    const payload = { sub: userId, email, username: username };

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

  async login(user: Pick<User, 'id' | 'email' | 'username'>) {
    return this.databaseService.$transaction(async (tx) => {
      const tokens = await this.generateTokens(
        user.id,
        user.email,
        user.username ?? undefined,
      );

      const hashedToken = createHash('sha256')
        .update(tokens.refreshToken)
        .digest('hex');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5); // 5 days

      await tx.session.create({
        data: {
          userId: user.id,
          refreshToken: hashedToken,
          expiresAt,
        },
      });

      return tokens;
    });
  }

  async createSession(
    userId: string,
    refreshToken: string,
    // userAgent?: string,
    // ipAddress?: string,
  ) {
    return this.databaseService.$transaction(async (tx) => {
      const hashedToken = createHash('sha256')
        .update(refreshToken)
        .digest('hex');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5); // 5 days

      await tx.session.create({
        data: {
          userId,
          refreshToken: hashedToken,
          // userAgent,
          // ipAddress,
          expiresAt,
        },
      });
    });
  }

  async refreshTokens(refreshToken: string) {
    return this.databaseService.$transaction(async (tx) => {
      try {
        // Step 1: Verify JWT token

        const payload = await this.jwtService.verifyAsync(refreshToken, {
          secret: process.env.JWT_REFRESH_SECRET,
        });

        // Step 2: Hash the token for database lookup
        const hashedToken = createHash('sha256')
          .update(refreshToken)
          .digest('hex');

        // Step 3: Find session in database

        const session = await tx.session.findFirst({
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

        // Step 4: Check if session and user exist
        if (!session || !session.user) {
          throw new ForbiddenException('Invalid or expired session');
        }

        // Step 5: Revoke old session

        await tx.session.update({
          where: { id: session.id },
          data: { revoked: true },
        });

        // Step 6: Generate new tokens

        const newTokens = await this.generateTokens(
          session.user.id,
          session.user.email,
          session.user.username ?? undefined,
        );

        // Step 7: Create new session
        const newHashedToken = createHash('sha256')
          .update(newTokens.refreshToken)
          .digest('hex');
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5); // 5 days

        await tx.session.create({
          data: {
            userId: session.user.id,
            refreshToken: newHashedToken,
            expiresAt,
          },
        });

        return newTokens;
      } catch (err) {
        console.error('❌ Refresh token error caught:', {
          name: err.name,
          message: err.message,
          stack: err.stack?.split('\n').slice(0, 3), // First 3 lines of stack
        });

        // Log specific error types for better debugging
        if (err.name === 'JsonWebTokenError') {
          console.error('🔐 JWT Error: Invalid token format or signature');
        } else if (err.name === 'TokenExpiredError') {
          console.error('⏰ JWT Error: Token has expired');
        } else if (err.name === 'NotBeforeError') {
          console.error('🕐 JWT Error: Token not active yet');
        } else if (err instanceof ForbiddenException) {
          console.error('🚫 Forbidden: Session invalid or expired');
        } else {
          console.error('❓ Unknown error type');
        }

        throw new UnauthorizedException('Access denied');
      }
    });
  }

  async logout(refreshToken: string) {
    return this.databaseService.$transaction(async (tx) => {
      const hashed = createHash('sha256').update(refreshToken).digest('hex');

      await tx.session.updateMany({
        where: { refreshToken: hashed },
        data: { revoked: true },
      });
    });
  }
}
