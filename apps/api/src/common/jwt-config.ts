import { ConfigService } from '@nestjs/config';

const INSECURE_SECRETS = new Set([
  'default-secret',
  'change-this-to-a-secure-random-string-in-production',
  'dev-only-insecure-secret',
]);

export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  const isProd = config.get<string>('NODE_ENV') === 'production';

  if (!secret || INSECURE_SECRETS.has(secret)) {
    if (isProd) {
      throw new Error('JWT_SECRET xavfsiz qiymat bilan o\'rnatilishi shart (production)');
    }
    return 'dev-only-insecure-secret';
  }

  if (isProd && secret.length < 32) {
    throw new Error('JWT_SECRET kamida 32 belgi bo\'lishi kerak (production)');
  }

  return secret;
}
