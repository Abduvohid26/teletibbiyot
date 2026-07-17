import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { ICE_SERVERS } from '../common/video-ice.config';
import { ROLES_CLINICAL } from '../common/roles.constants';
import { resolvePublicTurnUrl } from '../common/turn-url.util';

@ApiTags('Video')
@Controller('video')
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class VideoController {
  constructor(private config: ConfigService) {}

  @Get('ice-config')
  @Roles(...ROLES_CLINICAL)
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
      const creds = { username: turnUser || undefined, credential: turnPass || undefined };
      const hostPart = turnUrl.replace(/^turns?:/i, '').split('@').pop()?.replace(/^\//, '') ?? turnUrl;
      iceServers.push({
        urls: [
          `turn:${hostPart}?transport=udp`,
          `turn:${hostPart}?transport=tcp`,
        ],
        ...creds,
      });
      iceServers.push({
        urls: [
          `turns:${hostPart}?transport=tcp`,
        ],
        ...creds,
      });
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
