import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { ICE_SERVERS } from '../common/video-ice.config';
import { ROLES_CLINICAL_ADMIN } from '../common/roles.constants';
import { resolvePublicTurnUrl } from '../common/turn-url.util';

@ApiTags('Video')
@Controller('video')
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class VideoController {
  constructor(private config: ConfigService) {}

  @Get('ice-config')
  @Roles(...ROLES_CLINICAL_ADMIN)
  @ApiOperation({ summary: 'WebRTC ICE serverlar (STUN/TURN)' })
  getIceConfig() {
    const turnUrl = resolvePublicTurnUrl(this.config);
    const turnUser =
      this.config.get('TURN_PUBLIC_USERNAME') ||
      this.config.get('NEXT_PUBLIC_TURN_USERNAME') ||
      this.config.get('TURN_USERNAME');
    const turnPass =
      this.config.get('TURN_PUBLIC_PASSWORD') ||
      this.config.get('NEXT_PUBLIC_TURN_CREDENTIAL') ||
      this.config.get('TURN_PASSWORD');

    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [...ICE_SERVERS];

    if (turnUrl) {
      iceServers.push({
        urls: turnUrl,
        username: turnUser || undefined,
        credential: turnPass || undefined,
      });
      if (turnUrl.startsWith('turn:') && !turnUrl.startsWith('turns:')) {
        iceServers.push({
          urls: turnUrl.replace('turn:', 'turns:'),
          username: turnUser || undefined,
          credential: turnPass || undefined,
        });
      }
    }

    return {
      iceServers,
      turnConfigured: !!turnUrl,
      recommendations: [
        !turnUrl ? 'TURN server sozlang — uzoq hudud NAT tarmoqlari uchun majburiy' : null,
      ].filter(Boolean),
    };
  }
}
