import { Module } from '@nestjs/common';
import { BookService } from './book.service';
import { BookController } from './book.controller';
import { DatabaseModule } from 'src/database/database.module';
import { UploadService } from 'src/upload/upload.service';
import { S3Service } from 'src/aws/s3.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BookController],
  providers: [BookService, UploadService, S3Service],
})
export class BookModule {}
