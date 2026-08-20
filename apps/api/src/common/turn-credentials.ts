import { createHmac } from 'crypto';

/**
 * Vaqtinchalik TURN hisob ma'lumotlari (coturn `--use-auth-secret`, TURN REST API).
 *
 * NEGA KERAK: ilgari `.env` dagi doimiy parol brauzerga uzatilardi. U parol
 * bir marta sizib chiqsa (DevTools, log, bundle) — istalgan kishi relay'ni
 * cheksiz ishlatishi mumkin edi va uni almashtirish uchun hamma joyni qayta
 * deploy qilish kerak edi.
 *
 * Endi server har so'rovda qisqa muddatli juftlik yasaydi:
 *   username   = "<tugash_vaqti>:<foydalanuvchi>"
 *   credential = base64( HMAC-SHA1( sirli_kalit, username ) )
 *
 * Sirli kalit serverdan chiqmaydi. Sizib chiqqan parol TTL tugagach o'z-o'zidan
 * yaroqsiz bo'ladi va uni kim ishlatganini `username` dagi userId ko'rsatadi.
 */
export interface EphemeralTurnCredentials {
  username: string;
  credential: string;
  /** Necha soniyadan keyin eskiradi */
  ttl: number;
  expiresAt: number;
}

/** Konsultatsiya odatda 45 daqiqagacha — 4 soat zaxira bilan yetarli. */
export const TURN_CREDENTIAL_TTL_SECONDS = 4 * 60 * 60;

export function createEphemeralTurnCredentials(
  secret: string,
  userId: string,
  ttlSeconds: number = TURN_CREDENTIAL_TTL_SECONDS,
): EphemeralTurnCredentials {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  // coturn aynan shu formatni kutadi — o'zgartirmang.
  const username = `${expiresAt}:${userId}`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential, ttl: ttlSeconds, expiresAt };
}
