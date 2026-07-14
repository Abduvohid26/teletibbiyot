/** Brauzer ulanishi mumkin bo'lgan TURN manzillarni ajratish (Docker ichki hostname emas) */

const INTERNAL_HOST_PATTERNS = [
  'coturn',
  'localhost',
  '127.0.0.1',
  'ishifo-api',
  'ishifo-db',
  'minio',
  'redis',
  'postgres',
  '@internal',
];

export function isBrowserReachableTurnUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return !INTERNAL_HOST_PATTERNS.some((p) => lower.includes(p));
}

export function resolvePublicTurnUrl(
  config: { get: (key: string) => string | undefined },
): string | undefined {
  const candidates = [
    config.get('TURN_PUBLIC_URL'),
    config.get('NEXT_PUBLIC_TURN_URL'),
    config.get('TURN_URL'),
  ].filter((v): v is string => !!v?.trim());

  return candidates.find(isBrowserReachableTurnUrl);
}
