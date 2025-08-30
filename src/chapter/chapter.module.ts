import { Module } from '@nestjs/common';
import { ChapterService } from './chapter.service';
import { DatabaseModule } from 'src/database/database.module';
import {
  PublicChapterController,
  DashboardChapterController,
} from './chapter.controller';
@Module({
  imports: [DatabaseModule],
  controllers: [PublicChapterController, DashboardChapterController],
  providers: [ChapterService],
})
export class ChapterModule {}
