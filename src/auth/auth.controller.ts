import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { User } from 'generated/prisma';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: { email: string; password: string }) {
    return this.authService.createUser(body.email, body.password);
  }
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req: Request & { user: Pick<User, 'id' | 'email'> }) {
    return this.authService.login(req.user);
  }
}
