import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { DatabaseService } from 'src/database/database.service';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private databaseService: DatabaseService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
      // passReqToCallback:
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { emails, id: googleId } = profile;
    const email = emails[0].value;

    // Step 1: Check if Google account is already linked
    const existingAccount = await this.databaseService.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: googleId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      return existingAccount.user;
    }

    // Step 2: Does a user with the same email already exist?
    const existingUser = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Step 2a: Block if their email isn't verified
      if (!existingUser.emailVerified) {
        throw new ForbiddenException(
          'Please verify your email before logging in with Google.',
        );
      }

      // Step 2b: Safe to link Google to their existing account
      await this.databaseService.account.create({
        data: {
          provider: 'google',
          providerAccountId: googleId,
          userId: existingUser.id,
        },
      });

      return existingUser;
    }

    // Step 3: No existing user — create new one, mark as verified
    const newUser = await this.databaseService.user.create({
      data: {
        email,
        emailVerified: true,
        accounts: {
          create: {
            provider: 'google',
            providerAccountId: googleId,
          },
        },
      },
    });

    return newUser;
  }
}
