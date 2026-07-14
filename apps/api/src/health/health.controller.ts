import { Controller, Get, Res, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES_CLINICAL_ADMIN } from '../common/roles.constants';
import { StartupValidationService } from '../common/startup-validation.service';
import { resolvePublicTurnUrl } from '../common/turn-url.util';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: ConfigService,
    private startup: StartupValidationService,
  ) {}

  @Get()
  async check() {
    const isProd = this.config.get('NODE_ENV') === 'production';
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    if (isProd) {
      return {
        status: dbOk ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
      };
    }

    const services: Record<string, string> = { database: dbOk ? 'up' : 'down' };
    services.storage = this.storage.isAvailable() ? 'up' : 'down';
    services.redis = this.config.get('REDIS_URL') ? 'configured' : 'not_configured';

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
      version: '1.0.4',
    };
  }

  @Get('ready')
  async ready(@Res() res: Response) {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const s3Endpoint = this.config.get('S3_ENDPOINT');

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ ready: false });
    }

    if (isProd && s3Endpoint && !this.storage.isAvailable()) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ ready: false });
    }

    return res.status(HttpStatus.OK).json({ ready: true });
  }

  @Get('live')
  live() {
    return { live: true };
  }

  @Get('startup-checks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  startupChecks() {
    return { checks: this.startup.getChecks() };
  }

  @Get('video-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_CLINICAL_ADMIN)
  videoCheck() {
    const turnUrl = resolvePublicTurnUrl(this.config);
    const redisUrl = process.env.REDIS_URL;
    return {
      webrtc: {
        stun: 'stun:stun.l.google.com:19302',
        turnConfigured: !!turnUrl,
        turnUrl: turnUrl ? turnUrl.replace(/\/\/.*@/, '//***@') : null,
      },
      websocket: { redisAdapter: !!redisUrl },
      recommendations: [
        !turnUrl ? 'TURN server sozlang — rural NAT uchun majburiy' : null,
        !redisUrl ? 'REDIS_URL sozlang — ko\'p replika uchun' : null,
      ].filter(Boolean),
    };
  }
}
