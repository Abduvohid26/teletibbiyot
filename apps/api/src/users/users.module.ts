import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditModule } from '../audit/audit.module';
import { VideoModule } from '../video/video.module';

@Module({
  imports: [AuditModule, VideoModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
