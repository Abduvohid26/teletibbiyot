/**
 * TURN manzil validatsiyasi — API va brauzer UCHUN BITTA manba.
 *
 * Ilgari bu mantiq faqat API tomonda bor edi (turn-url.util.ts). Brauzer esa
 * `NEXT_PUBLIC_TURN_URL` ni tekshirmasdan ishlatardi, shuning uchun
 * `turn:localhost:3478` kabi qiymat "TURN sozlangan" deb hisoblanardi —
 * vaholanki boshqa qurilmaning brauzeri uchun "localhost" O'ZINI bildiradi va
 * u yerda hech qanday TURN server yo'q. Natija: bir tarmoqda hammasi ishlaydi
 * (host candidate yetarli), turli tarmoqlarda esa hech qachon ulanmaydi.
 */

/** Docker/ichki xizmat nomlari va loopback — brauzer ularga yeta olmaydi. */
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

/** Bu TURN manzilga BOSHQA qurilmadagi brauzer yeta oladimi? */
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

/** Nega bu manzil yaroqsiz — sozlash xatosini aniq aytish uchun */
export function describeTurnUrlProblem(url: string): string | null {
  const host = extractTurnHostname(url);
  if (!host) return 'TURN manzilini o\'qib bo\'lmadi';
  if (host.startsWith('127.') || INTERNAL_HOSTNAMES.has(host)) {
    return `"${host}" — bu loopback yoki Docker ichki nomi. Boshqa qurilmaning brauzeri unga yeta olmaydi. Serverning OMMAVIY IP yoki domenini yozing.`;
  }
  if (!isIpv4(host) && !isIpv6(host) && !host.includes('.')) {
    return `"${host}" — nuqtasiz nom (ichki xizmat nomi). Ommaviy IP yoki to'liq domen (FQDN) kerak.`;
  }
  return null;
}

/**
 * SFU/signaling URL (ws:// yoki wss://) brauzer uchun yaroqlimi?
 *
 * TURN bilan bir xil muammo: `ws://localhost:7880` server uchun to'g'ri
 * ko'rinadi, lekin BOSHQA qurilmadagi brauzer uchun bu o'sha qurilmaning o'zi.
 * Bunday URL'ni klientga berish — uni ataylab ishlamaydigan ulanishga yuborish.
 */
export function isBrowserReachableSignalUrl(url: string): boolean {
  const raw = url?.trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    if (!['ws:', 'wss:', 'http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (INTERNAL_HOSTNAMES.has(host)) return false;
    if (host.startsWith('127.')) return false;
    if (isIpv4(host) || isIpv6(host)) return true;
    return host.includes('.');
  } catch {
    return false;
  }
}

export function describeSignalUrlProblem(url: string): string | null {
  const raw = url?.trim();
  if (!raw) return 'URL bo\'sh';
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return `"${raw}" — URL formati noto'g'ri (ws:// yoki wss:// bo'lishi kerak)`;
  }
  if (host.startsWith('127.') || INTERNAL_HOSTNAMES.has(host)) {
    return `"${host}" — loopback yoki Docker ichki nomi. Boshqa qurilmaning brauzeri unga yeta olmaydi. Ommaviy domen (wss://ishifo.uz/livekit) yoki IP yozing.`;
  }
  if (!isIpv4(host) && !isIpv6(host) && !host.includes('.')) {
    return `"${host}" — nuqtasiz ichki nom. Ommaviy IP yoki to'liq domen kerak.`;
  }
  return null;
}
