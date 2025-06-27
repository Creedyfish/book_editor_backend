import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginStrategyDto } from './dto/auth/login.dto';
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' }); // use 'email' instead of 'username'
  }

  async validate(email: string, password: string) {
    const input = plainToInstance(LoginStrategyDto, { email, password });
    const errors = await validate(input);

    if (errors.length > 0) {
      throw new UnauthorizedException('Invalid login format');
    }

    const user = await this.authService.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    return user;
  }
}
