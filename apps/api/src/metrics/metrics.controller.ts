import { Controller, Get, Header, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@SkipThrottle()
@Controller()
export class MetricsController {
  constructor(
    private metrics: MetricsService,
    private config: ConfigService,
  ) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async prometheus(@Req() req: Request) {
    const expected = this.config.get('METRICS_BEARER_TOKEN');
    const isProd = this.config.get('NODE_ENV') === 'production';

    if (expected) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${expected}`) {
        throw new UnauthorizedException();
      }
    } else if (isProd) {
      throw new UnauthorizedException('METRICS_BEARER_TOKEN sozlanmagan');
    }

    return this.metrics.collectPrometheus();
  }
}
