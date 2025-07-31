import {
  Controller,
  Get,
  Request,
  UseGuards,
  Patch,
  Body,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport';
import { UpdateUsernameDto } from './dto/update-username.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Request() req) {
    return this.userService.getUser(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('username')
  async updateUsername(@Request() req, @Body() dto: UpdateUsernameDto) {
    const user = await this.userService.usernameUpdate(
      dto.username,
      req.user.id,
    );

    return {
      createdAt: user.createdAt,
      email: user.email,
      updatedAt: user.updatedAt,
      username: user.username,
    };
  }
}
