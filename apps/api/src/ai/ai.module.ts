import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AttachmentAnalysisService } from './attachment-analysis.service';
import { StorageModule } from '../storage/storage.module';
import { VideoModule } from '../video/video.module';

@Module({
  imports: [StorageModule, VideoModule],
  controllers: [AiController],
  providers: [AiService, AttachmentAnalysisService],
  exports: [AiService, AttachmentAnalysisService],
})
export class AiModule {}
