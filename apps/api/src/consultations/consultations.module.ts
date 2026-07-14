import { Module, forwardRef } from '@nestjs/common';
import { ConsultationsService } from './consultations.service';
import { ConsultationsController } from './consultations.controller';
import { AiModule } from '../ai/ai.module';
import { VideoModule } from '../video/video.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [forwardRef(() => AiModule), VideoModule, ReportsModule],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
