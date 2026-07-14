import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from './jwt-config';
import { resolvePublicTurnUrl } from './turn-url.util';

export interface StartupCheck {
  name: string;
  ok: boolean;
  severity: 'error' | 'warn' | 'info';
  message: string;
}

@Injectable()
export class StartupValidationService implements OnModuleInit {
  private readonly logger = new Logger(StartupValidationService.name);
  private checks: StartupCheck[] = [];

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.checks = this.runChecks();
    const errors = this.checks.filter((c) => !c.ok && c.severity === 'error');
    const warnings = this.checks.filter((c) => !c.ok && c.severity === 'warn');

    for (const w of warnings) {
      this.logger.warn(`[Startup] ${w.name}: ${w.message}`);
    }

    if (errors.length) {
      for (const e of errors) {
        this.logger.error(`[Startup] ${e.name}: ${e.message}`);
      }
      throw new Error(`Production startup tekshiruvi muvaffaqiyatsiz (${errors.length} xato)`);
    }

    this.logger.log(`Startup tekshiruvi o'tdi (${this.checks.length} tekshiruv)`);
  }

  getChecks() {
    return this.checks;
  }

  private runChecks(): StartupCheck[] {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const checks: StartupCheck[] = [];

    try {
      getJwtSecret(this.config);
      checks.push({ name: 'JWT_SECRET', ok: true, severity: 'info', message: 'OK' });
    } catch (err) {
      checks.push({
        name: 'JWT_SECRET',
        ok: !isProd,
        severity: isProd ? 'error' : 'warn',
        message: err instanceof Error ? err.message : 'JWT xato',
      });
    }

    const openAiKey = this.config.get('OPENAI_API_KEY');
    const openAiOk = !!openAiKey && openAiKey !== 'your-openai-api-key-here';
    const isStaging = this.config.get('STAGING') === 'true' || this.config.get('ALLOW_SEED') === 'true';
    checks.push({
      name: 'OPENAI_API_KEY',
      ok: openAiOk || !isProd || isStaging,
      severity: isProd && !openAiOk && !isStaging ? 'error' : 'info',
      message: openAiOk
        ? 'OK'
        : isProd && !isStaging
          ? 'Production uchun OpenAI kaliti majburiy'
          : 'Development/staging — mock yoki ixtiyoriy AI',
    });

    if (isProd) {
      if (this.config.get('STAGING') === 'true') {
        checks.push({
          name: 'STAGING_FLAG',
          ok: false,
          severity: 'error',
          message: 'Productionda STAGING=true taqiqlangan — xavfsizlik tekshiruvlari o\'chiriladi',
        });
      }

      const redis = this.config.get('REDIS_URL');
      const isStaging = false;
      checks.push({
        name: 'REDIS_URL',
        ok: !!redis || isStaging,
        severity: isStaging ? 'warn' : 'error',
        message: redis ? 'OK' : isStaging ? 'Staging — Redis ixtiyoriy' : 'Production uchun Redis majburiy (WebSocket adapter)',
      });

      const turn = resolvePublicTurnUrl(this.config);
      const rawTurn = this.config.get('TURN_URL') || this.config.get('NEXT_PUBLIC_TURN_URL');
      const turnInternalOnly = !!rawTurn && !turn;
      checks.push({
        name: 'TURN_PUBLIC',
        ok: !!turn || isStaging,
        severity: isStaging ? 'warn' : 'error',
        message: turn
          ? 'OK'
          : turnInternalOnly
            ? 'TURN_URL ichki hostname (coturn) — TURN_PUBLIC_URL yoki NEXT_PUBLIC_TURN_URL o\'rnating'
            : isStaging
              ? 'Staging — TURN ixtiyoriy'
              : 'Rural NAT uchun brauzer ulanadigan TURN manzili majburiy',
      });

      const encKey = this.config.get('ENCRYPTION_KEY');
      checks.push({
        name: 'ENCRYPTION_KEY',
        ok: (!!encKey && encKey.length >= 32) || isStaging,
        severity: isStaging ? 'warn' : 'error',
        message:
          encKey && encKey.length >= 32
            ? 'OK'
            : 'Production uchun ENCRYPTION_KEY (32+ belgi) majburiy — PINFL/telefon shifrlash',
      });

      const cors = this.config.get('CORS_ORIGINS') || '';
      checks.push({
        name: 'CORS_ORIGINS',
        ok: !!cors.trim() && !cors.includes('localhost'),
        severity: 'error',
        message: cors.trim()
          ? cors.includes('localhost')
            ? 'CORS_ORIGINS production domenini ko\'rsating'
            : 'OK'
          : 'CORS_ORIGINS majburiy',
      });

      const s3 = this.config.get('S3_ENDPOINT');
      checks.push({
        name: 'S3_STORAGE',
        ok: !!s3 || isStaging,
        severity: isStaging ? 'warn' : 'error',
        message: s3 ? 'OK' : isStaging ? 'Staging — S3 ixtiyoriy' : 'Fayl saqlash (MinIO/S3) majburiy',
      });

      if (this.config.get('ALLOW_SEED') === 'true') {
        checks.push({
          name: 'ALLOW_SEED',
          ok: false,
          severity: 'error',
          message: 'Productionda ALLOW_SEED=true taqiqlangan',
        });
      }
    }

    const smsProvider = this.config.get('SMS_PROVIDER') || 'mock';
    const smtpHost = this.config.get('SMTP_HOST');
    const strictComms = isProd && this.config.get('STRICT_COMMS') === 'true';
    if (isProd) {
      checks.push({
        name: 'NOTIFICATIONS',
        ok: smsProvider !== 'mock' || !!smtpHost,
        severity: strictComms ? 'error' : 'warn',
        message:
          smsProvider !== 'mock' || smtpHost
            ? 'OK'
            : strictComms
              ? 'SMS va SMTP sozlanmagan — STRICT_COMMS=true'
              : 'SMS va SMTP sozlanmagan — favqulodda ogohlantirishlar faqat in-app',
      });

      const metricsToken = this.config.get('METRICS_BEARER_TOKEN');
      checks.push({
        name: 'METRICS_BEARER_TOKEN',
        ok: !!metricsToken && metricsToken.length >= 16,
        severity: 'error',
        message: metricsToken ? 'OK' : 'Prometheus uchun METRICS_BEARER_TOKEN majburiy',
      });
    }

    const deviceMode = this.config.get('DEVICE_MODE') || 'simulator';
    if (isProd && deviceMode === 'simulator') {
      checks.push({
        name: 'DEVICE_MODE',
        ok: true,
        severity: 'warn',
        message: 'DEVICE_MODE=simulator — haqiqiy qurilmalar ulanmagan (pilot uchun OK)',
      });
    }

    return checks;
  }
}
