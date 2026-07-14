import { ConfigService } from '@nestjs/config';

export function resolveAuthCookieOptions(config: ConfigService) {
  const secure =
    config.get('COOKIE_SECURE') === 'true' ||
    (config.get('NODE_ENV') === 'production' && config.get('COOKIE_SECURE') !== 'false');
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
}
