import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { DatabaseService } from 'src/database/database.service';

import {
  EmailNotVerifiedException,
  EmailAlreadyExistsException,
} from './exceptions/oauth.exceptions';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private databaseService: DatabaseService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { emails, id: googleId, email_verified } = profile;
    const email = emails[0].value;
    const emailVerified = emails?.[0]?.verified ?? false;

    if (!emailVerified) {
      return done(new EmailNotVerifiedException(), false);
    }

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
      return done(null, existingAccount.user);
    }

    const existingUser = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const error = new EmailAlreadyExistsException();
      return done(error, false);
    }

    const newUser = await this.databaseService.user.create({
      data: {
        email,
        emailVerified: email_verified,
        accounts: {
          create: {
            provider: 'google',
            providerAccountId: googleId,
          },
        },
      },
    });

    return done(null, newUser);
  }
}
