import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { VideoGateway } from './video.gateway';
import { VideoController } from './video.controller';
import { DoctorPresenceService } from './doctor-presence.service';
import { getJwtSecret } from '../common/jwt-config';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: getJwtSecret(config),
      }),
    }),
  ],
  controllers: [VideoController],
  providers: [VideoGateway, DoctorPresenceService],
  exports: [VideoGateway, DoctorPresenceService],
})
export class VideoModule {}
