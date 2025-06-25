import {
  Body,
  Controller,
  Post,
  UseGuards,
  Req,
  Res,
  Get,
  UseFilters,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { User } from 'generated/prisma';
import {
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { OAuthExceptionFilter } from './exceptions/oauth-exception.filter';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private emailService: MailService,
  ) {}

  @Post('register')
  async register(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const newUser = await this.authService.createUser(
      body.email,
      body.password,
    );

    const code = await this.authService.createEmailVerificationCode(newUser.id);
    await this.emailService.sendVerificationCode(newUser.email, code);
    const emailToken = await this.emailService.generateEmailToken(
      newUser.email,
    );

    res.cookie('email_verification_token', emailToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/',
    });
    return { message: 'email token sent' };
  }

  @Get('email-token')
  async getEmail(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['email_verification_token'];
    const payload =
      await this.emailService.verifyEmailTokenAndGetPayload(token);
    if (!payload) {
      throw new UnauthorizedException();
    }

    return { email: payload.email };
  }

  @Post('email-verification')
  async verify(
    @Req() req: Request,
    @Body() body: { code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['email_verification_token'];
    const payload =
      await this.emailService.verifyEmailTokenAndGetPayload(token);
    if (!payload) {
      throw new UnauthorizedException();
    }
    const verifiedUser = await this.authService.verifyUserEmailCode(
      body.code,
      payload.email,
    );

    const tokens = await this.authService.login({
      id: verifiedUser.id,
      email: verifiedUser.email,
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',

      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.clearCookie('email_verification_token');

    return { accessToken: tokens.accessToken };
  }

  @Post('resend-verification')
  async resendEmailVerification(
    @Req() req: Request,
    @Body() body: { email: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['email_verification_token'];

    if (token) {
      // Verify token is still valid
      const isValidToken =
        await this.emailService.verifyEmailTokenAndGetPayload(
          token,
          body.email,
        );

      if (isValidToken) {
        await this.authService.resendEmailVerificationCode(body.email);
        const emailToken = await this.emailService.generateEmailToken(
          body.email,
        );

        res.cookie('email_verification_token', emailToken, {
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 10 * 60 * 1000,
          path: '/',
        });
        return { message: 'email token sent' };
      }
    }

    return {
      message:
        'Token expired or invalid. Please use /resend-verification-with-login',
      requiresLogin: true,
    };
  }

  @Post('resend-verification-with-login')
  @UseGuards(AuthGuard('local'))
  async resendEmailVerificationWithLogin(
    @Req() req: Request & { user: Pick<User, 'id' | 'email'> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user; // Available after local auth
    await this.authService.resendEmailVerificationCode(user.email);
    const emailToken = await this.emailService.generateEmailToken(user.email);

    res.cookie('email_verification_token', emailToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    return { message: 'email token sent' };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = await req.cookies['refresh_token'];

    if (refreshToken) {
      // Add await here
      await this.authService.logout(refreshToken);

      // Clear the refresh token cookie
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/', // Same path as when setting the cookie
      });

      // Return success response
      return { message: 'Logged out successfully' };
    } else {
      throw new UnauthorizedException('No refresh token found');
    }
  }

  @Get('check-refresh')
  async checkRefreshToken(@Req() req: Request) {
    const refreshToken = await req.cookies['refresh_token'];
    // const cookieHeader = req.headers.cookie;
    // const refreshToken = cookieHeader
    //   ? cookieHeader
    //       .split(';')
    //       .map((cookie) => cookie.trim())
    //       .find((cookie) => cookie.startsWith('refresh_token='))
    //       ?.split('=')[1]
    //   : undefined;

    if (refreshToken) {
      return { hasRefreshToken: true };
    }

    return { hasRefreshToken: false };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = await req.cookies?.['refresh_token'];
    // const cookieHeader = req.headers.cookie;
    // const refreshToken = cookieHeader
    //   ? cookieHeader
    //       .split(';')
    //       .map((cookie) => cookie.trim())
    //       .find((cookie) => cookie.startsWith('refresh_token='))
    //       ?.split('=')[1]
    //   : undefined;

    if (!refreshToken) throw new UnauthorizedException();

    const tokens = await this.authService.refreshTokens(refreshToken);

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',

      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken: tokens.accessToken };
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(
    @Req()
    req: Request & { user: Pick<User, 'id' | 'email' | 'emailVerified'> },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!req.user.emailVerified) {
      throw new ForbiddenException('Please verify your email first');
    }
    const tokens = await this.authService.login(req.user);

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',

      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken: tokens.accessToken };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleLogin() {
    // Redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @UseFilters(OAuthExceptionFilter)
  async googleCallback(
    @Req() req: Request & { user: Pick<User, 'id' | 'email'> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(req.user);

    // Here you can generate JWT, set cookie, etc.
    // req.user contains the data from GoogleStrategy.validate()

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',

      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',

      maxAge: 30 * 1000,
    });

    // return { accessToken: tokens.accessToken };
    return res.redirect(`${process.env.REDIRECT_URL}/auth/google/success`);
  }
}
