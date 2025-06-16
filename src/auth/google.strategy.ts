import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { DatabaseService } from 'src/database/database.service';

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
    const { name, emails, photos, id } = profile;

    const existingAccount = await this.databaseService.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: id,
        },
      },
      include: { user: true },
    });

    let user;
    if (!existingAccount) {
      user = await this.databaseService.user.create({
        data: {
          email: emails[0].value,
          accounts: {
            create: {
              provider: 'google',
              providerAccountId: id,
            },
          },
        },
      });
    } else {
      user = existingAccount.user;
    }
    return user;
  }
}
