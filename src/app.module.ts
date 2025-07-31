import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './user/user.module';
import { MailService } from './mail/mail.service';
import { MailModule } from './mail/mail.module';
import { JwtService } from '@nestjs/jwt';
import { BookModule } from './book/book.module';
import { S3Service } from './aws/s3.service';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './upload/upload.service';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    UserModule,
    BookModule,
    MailModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, MailService, JwtService, S3Service, UploadService],
})
export class AppModule {}
