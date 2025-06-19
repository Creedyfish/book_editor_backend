import {
  Body,
  Controller,
  Post,
  UseGuards,
  Req,
  Res,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { User } from 'generated/prisma';
import { UnauthorizedException } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private emailService: MailService,
  ) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string }) {
    const newUser = await this.authService.createUser(
      body.email,
      body.password,
    );

    const code = await this.authService.createEmailVerificationCode(newUser.id);
    return this.emailService.sendVerificationCode(body.email, code);
  }

  @Post('email-verification')
  async verify(@Body() body: { email: string; code: string }) {
    const verifiedUser = await this.authService.UserCodeVerification(
      body.code,
      body.email,
    );

    return verifiedUser;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = await req.cookies['refresh_token'];
    console.log({ 'current refreshToken': refreshToken });

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
    console.log('refresh token check initiated');
    console.log(req.cookies);
    if (refreshToken) {
      console.log('has  refresh');
      return { hasRefreshToken: true };
    }
    console.log('no refresh');
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
    console.log({ 'refresh token being sent from the client': refreshToken });
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
    @Req() req: Request & { user: Pick<User, 'id' | 'email'> },
    @Res({ passthrough: true }) res: Response,
  ) {
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
  async googleCallback(
    @Req() req: Request & { user: Pick<User, 'id' | 'email'> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(req.user);

    // Here you can generate JWT, set cookie, etc.
    // req.user contains the data from GoogleStrategy.validate()
    console.log(req.user);
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
    console.log({ 'shit has been sent ': tokens.accessToken });
    // return { accessToken: tokens.accessToken };
    return res.redirect('http://localhost:3000/auth/google/success');
  }
}
