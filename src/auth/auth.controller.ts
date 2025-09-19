import {
  Body,
  Controller,
  Post,
  UseGuards,
  Req,
  Res,
  Get,
  UnauthorizedException,
  ForbiddenException,
  UseFilters,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { MailService } from 'src/mail/mail.service';
import { OAuthExceptionFilter } from './exceptions/oauth-exception.filter';
import { RegisterDto } from './dto/auth/register.dto';
import { User } from 'generated/prisma';
import { LoginDto } from './dto/auth/login.dto';
import { EmailPurposeDto } from './dto/email/email-purpose.dto';
import { VerifyEmailCodeDto } from './dto/email/verify-email-code.dto';
import { ResendVerificationDto } from './dto/email/resend-verification.dto';
import { RequestPasswordResetDto } from './dto/password/request-password-reset.dto';
import { ResetPasswordDto } from './dto/password/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: MailService,
  ) {}

  // ─────────────────────────────────────────────
  // ▶ EMAIL/PASSWORD AUTH FLOW
  // ─────────────────────────────────────────────

  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const verifyCloudfare = await this.authService.verifyTurnstileToken(
      body.token,
    );

    if (!verifyCloudfare) throw new UnauthorizedException('Please try again');

    const newUser = await this.authService.createUser(
      body.email,
      body.password,
    );
    const code = await this.authService.createEmailVerificationCode(newUser.id);

    await this.emailService.sendCodeEmail(
      newUser.email,
      code,
      'email-verification',
    );

    const emailToken = await this.emailService.generateEmailToken(
      newUser.email,
      'email-verification',
    );

    res.cookie('email_verification_token', emailToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    return { message: 'email token sent' };
  }

  @Post('login')
  @UseGuards(AuthGuard('local'))
  async login(
    @Req()
    req: Request & {
      user: Pick<User, 'id' | 'email' | 'emailVerified' | 'username'>;
    },
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!req.user.emailVerified)
      throw new ForbiddenException('Please verify your email first');

    const verifyCloudfare = await this.authService.verifyTurnstileToken(
      body.token,
    );
    if (!verifyCloudfare) throw new UnauthorizedException('Please try again');

    const tokens = await this.authService.login(req.user);

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken: tokens.accessToken };
  }

  // ─────────────────────────────────────────────
  // ▶ EMAIL VERIFICATION FLOW
  // ─────────────────────────────────────────────

  @Post('email-token')
  async getEmail(@Req() req: Request, @Body() body: EmailPurposeDto) {
    const cookieName =
      body.purpose === 'password-reset'
        ? 'reset_password_token'
        : 'email_verification_token';

    const token = req.cookies[cookieName];

    const payload = await this.emailService.verifyTokenAndGetPayload(
      token,
      body.purpose,
    );
    if (!payload) throw new UnauthorizedException();

    return { email: payload.email };
  }

  @Post('email-verification')
  async verifyEmailCode(
    @Req() req: Request,
    @Body() body: VerifyEmailCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['email_verification_token'];
    const payload = await this.emailService.verifyTokenAndGetPayload(
      token,
      'email-verification',
    );

    if (!payload) throw new UnauthorizedException();

    const verifiedUser = await this.authService.verifyUserEmailCode(
      body.code,
      payload.email,
    );
    const tokens = await this.authService.login({
      id: verifiedUser.id,
      email: verifiedUser.email,
      username: verifiedUser.username,
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.clearCookie('email_verification_token');

    return { accessToken: tokens.accessToken };
  }

  @Post('resend-verification')
  async resendEmailVerification(
    @Req() req: Request,
    @Body() body: ResendVerificationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['email_verification_token'];

    const isValidToken = token
      ? await this.emailService.verifyTokenAndGetPayload(
          token,
          'email-verification',
          body.email,
        )
      : null;

    if (!isValidToken) {
      throw new UnauthorizedException({
        message: 'Verification time expired',
        requiresLogin: true,
      });
    }

    await this.authService.resendEmailVerificationCode(body.email);

    const emailToken = await this.emailService.generateEmailToken(
      body.email,
      'email-verification',
    );

    res.cookie('email_verification_token', emailToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    return { message: 'email token sent' };
  }

  @Post('resend-verification-with-login')
  @UseGuards(AuthGuard('local'))
  async resendEmailVerificationWithLogin(
    @Req() req: Request & { user: Pick<User, 'id' | 'email'> },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.resendEmailVerificationCode(req.user.email);

    const emailToken = await this.emailService.generateEmailToken(
      req.user.email,
      'email-verification',
    );

    res.cookie('email_verification_token', emailToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    return { message: 'email token sent' };
  }

  // ─────────────────────────────────────────────
  // ▶ PASSWORD RESET FLOW
  // ─────────────────────────────────────────────

  @Post('request-password-reset')
  async requestPasswordReset(
    @Body() body: RequestPasswordResetDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const verifyCloudfare = await this.authService.verifyTurnstileToken(
      body.token,
    );
    if (!verifyCloudfare) throw new UnauthorizedException('Please try again');

    const emailToken = await this.emailService.generateEmailToken(
      body.email,
      'password-reset',
    );

    res.cookie('reset_password_token', emailToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    return this.authService.requestPasswordReset(body.email);
  }

  @Post('reset-password')
  async resetPassword(
    @Req() req: Request,
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies['reset_password_token'];
    const payload = await this.emailService.verifyTokenAndGetPayload(
      token,
      'password-reset',
    );

    if (!payload) throw new UnauthorizedException();
    res.clearCookie('reset_password_token');
    return this.authService.passwordReset(
      body.code,
      body.password,
      payload.email,
    );
  }

  // ─────────────────────────────────────────────
  // ▶ TOKEN MANAGEMENT
  // ─────────────────────────────────────────────

  @Post('refresh')
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];

    if (!refreshToken) {
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/',
      });
      throw new UnauthorizedException();
    }

    try {
      const tokens = await this.authService.refreshTokens(refreshToken);

      res.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return { accessToken: tokens.accessToken };
    } catch (err) {
      // 🧹 If refresh token is invalid or session is revoked — clear the cookie
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/',
      });
      throw new UnauthorizedException('Session invalid or expired');
    }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken)
      throw new UnauthorizedException('No refresh token found');

    await this.authService.logout(refreshToken);

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }

  @Get('check-refresh')
  async checkRefreshToken(@Req() req: Request) {
    const hasToken = Boolean(req.cookies?.['refresh_token']);
    return { hasRefreshToken: hasToken };
  }

  // ─────────────────────────────────────────────
  // ▶ GOOGLE OAUTH
  // ─────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleLogin() {
    // Redirect to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @UseFilters(OAuthExceptionFilter)
  async googleCallback(
    @Req() req: Request & { user: Pick<User, 'id' | 'email' | 'username'> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(req.user);

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 30 * 1000,
    });

    return res.redirect(`${process.env.REDIRECT_URL}/auth/google/success`);
  }
}
