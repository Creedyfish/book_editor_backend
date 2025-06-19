import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './user/user.module';
import { MailService } from './mail/mail.service';

@Module({
  imports: [AuthModule, DatabaseModule, UserModule],
  controllers: [AppController],
  providers: [AppService, MailService],
})
export class AppModule {}
