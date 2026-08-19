import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { getJwtSecret } from './common/jwt-config';
import { RedisIoAdapter } from './video/redis-io.adapter';
import { diagnoseTurnConfig } from './common/turn-url.util';
import { LivekitService } from './video/livekit.service';
import { BRAND } from '@ishifo/shared';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  const redisUrl = configService.get<string>('REDIS_URL');
  if (redisUrl) {
    try {
      const redisAdapter = new RedisIoAdapter(app, redisUrl);
      const timeoutMs = isProduction ? 30000 : 5000;
      await Promise.race([
        redisAdapter.connectToRedis(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Redis ulanish timeout (${timeoutMs}ms)`)), timeoutMs),
        ),
      ]);
      app.useWebSocketAdapter(redisAdapter);
      logger.log('WebSocket: Redis adapter faol');
    } catch (err) {
      if (isProduction) {
        logger.error(`Redis adapter majburiy (production): ${err}`);
        process.exit(1);
      }
      logger.warn(`Redis adapter ulanmadi, in-memory WS ishlatiladi: ${err}`);
    }
  }

  // TURN sozlamasi noto'g'ri bo'lsa, muammo faqat ikki tomon TURLI TARMOQDA
  // bo'lganda bilinadi — ya'ni odatda ishlab chiqarishda, jonli konsultatsiya
  // paytida. Shuning uchun buni ishga tushirishdayoq baland aytamiz.
  const turnDiagnosis = diagnoseTurnConfig(configService);
  if (turnDiagnosis.ok) {
    logger.log('TURN: brauzer yeta oladigan manzil topildi');
  } else {
    logger.error('TURN SOZLAMASI YAROQSIZ — turli tarmoqdagi (masalan mobil internet ↔ Wi-Fi) shifokor va UT operator BIR-BIRINI KO\'RMAYDI:');
    turnDiagnosis.problems.forEach((p) => logger.error(`  • ${p}`));
    logger.error('  → .env da TURN_PUBLIC_URL / NEXT_PUBLIC_TURN_URL ni serverning OMMAVIY IP yoki domeniga o\'zgartiring va TURN_EXTERNAL_IP ni o\'rnating.');
  }

  // LiveKit SFU holati — TURN bilan bir xil sabab: noto'g'ri URL bilan
  // "yoqilgan" bo'lib ko'rinsa, klient ulanolmay P2P ga qaytadi va buni hech
  // kim sezmaydi. Shuning uchun ishga tushirishda aniq aytamiz.
  try {
    const livekit = app.get(LivekitService);
    const lk = livekit.diagnose();
    if (lk.enabled) {
      logger.log(`LiveKit SFU: FAOL → ${lk.url}`);
    } else if (configService.get('LIVEKIT_ENABLED') === 'true') {
      logger.error(`LiveKit SFU yoqilgan, LEKIN ishlatilmaydi: ${lk.problem ?? 'API kalit/secret yetishmayapti'}`);
      logger.error('  → Video P2P (brauzer↔brauzer) rejimida ishlaydi.');
    } else {
      logger.log('LiveKit SFU: o\'chirilgan — video P2P rejimida');
    }
  } catch {
    /* LivekitService mavjud emas — e'tibor bermaymiz */
  }

  if (configService.get('TRUST_PROXY') === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());

  const clientHeader = 'x-ishifo-client';
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isProduction || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    if (req.path.startsWith('/api/health') || req.path === '/api/metrics') {
      return next();
    }
    if (req.headers[clientHeader] === 'web') {
      return next();
    }
    return res.status(403).json({ message: 'Noto\'g\'ri so\'rov manbasi' });
  });

  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) || [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const swaggerEnabled =
    !isProduction && configService.get('SWAGGER_ENABLED') !== 'false';

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(`${BRAND.name} API`)
      .setDescription(`${BRAND.supporter} — ${BRAND.name} platformasi`)
      .setVersion('1.0.4')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger: /api/docs');
  }

  const jwtSecret = getJwtSecret(configService);
  if (jwtSecret === 'dev-only-insecure-secret') {
    logger.warn('JWT_SECRET o\'rnatilmagan — faqat development rejimida ishlaydi');
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`${BRAND.name} API: http://localhost:${port}`);
  logger.log(`Health: http://localhost:${port}/api/health`);
}

bootstrap();
