/** Brauzer ulanishi mumkin bo'lgan TURN manzillarni ajratish (Docker ichki hostname emas) */

/** Docker/ichki xizmat nomlari va loopback manzillari — brauzer ularga yeta olmaydi. */
const INTERNAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '::',
  'turn',
  'coturn',
  'api',
  'web',
  'nginx',
  'minio',
  'redis',
  'postgres',
  'ishifo-api',
  'ishifo-web',
  'ishifo-db',
  'ishifo-turn',
  'ishifo-coturn',
  'ishifo-minio',
  'ishifo-redis',
]);

/**
 * TURN URL'dan sof hostname ajratadi:
 *   turn:user:pass@203.0.113.10:3478?transport=udp  →  203.0.113.10
 *   turns:[2001:db8::1]:5349                        →  2001:db8::1
 */
export function extractTurnHostname(url: string): string | null {
  let rest = url.trim().toLowerCase();
  if (!rest) return null;

  rest = rest.replace(/^turns?:/, ''); // sxema
  rest = rest.split('?')[0]; // ?transport=udp
  if (rest.includes('@')) rest = rest.slice(rest.lastIndexOf('@') + 1); // user:pass@

  // IPv6 qavs ichida: [2001:db8::1]:5349
  const bracket = rest.match(/^\[([^\]]+)\]/);
  if (bracket) return bracket[1] || null;

  // IPv6 qavssiz (bir nechta ':') — portsiz deb qabul qilamiz
  const colons = (rest.match(/:/g) || []).length;
  if (colons > 1) return rest.replace(/\/+$/, '') || null;

  const host = rest.split(':')[0].replace(/\/+$/, '');
  return host || null;
}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isIpv6(host: string): boolean {
  return host.includes(':');
}

export function isBrowserReachableTurnUrl(url: string): boolean {
  const host = extractTurnHostname(url);
  if (!host) return false;

  if (INTERNAL_HOSTNAMES.has(host)) return false;
  if (host.startsWith('127.')) return false; // butun 127.0.0.0/8 loopback

  // IP bo'lsa — yuqoridagi tekshiruvlardan o'tgan bo'lsa yaroqli.
  if (isIpv4(host) || isIpv6(host)) return true;

  // Nuqtasiz nom (masalan "turn", "my-service") — bu Docker/ichki xizmat nomi.
  // Brauzer uni hal qila olmaydi; ommaviy TURN IP yoki FQDN bo'lishi shart.
  return host.includes('.');
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
