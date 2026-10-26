import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { VideoModule } from '../video/video.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [VideoModule, StorageModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
