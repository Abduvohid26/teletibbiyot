import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AttachmentAnalysisService } from './attachment-analysis.service';
import { MonitorVitalsService } from './monitor-vitals.service';
import { StorageModule } from '../storage/storage.module';
import { VideoModule } from '../video/video.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [StorageModule, VideoModule, CommonModule],
  controllers: [AiController],
  providers: [AiService, AttachmentAnalysisService, MonitorVitalsService],
  exports: [AiService, AttachmentAnalysisService, MonitorVitalsService],
})
export class AiModule {}
