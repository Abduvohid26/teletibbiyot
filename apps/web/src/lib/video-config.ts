import { isBrowserReachableTurnUrl } from '@ishifo/shared';
import { api } from '@/lib/api';
import { ICE_SERVERS as DEFAULT_ICE } from './video-config-base';

export * from './video-config-base';

let cachedIceServers: RTCIceServer[] | null = null;
let iceTurnConfigured: boolean | null = null;
let fetchPromise: Promise<RTCIceServer[]> | null = null;
let iceConfigError: string | null = null;

/**
 * ICE konfiguratsiyasini olishda muammo bo'lganmi.
 *
 * Bu endpoint 401/500 qaytarsa, ilova build vaqtida "pishirilgan"
 * NEXT_PUBLIC_TURN_URL ga tushadi. Agar image eski qiymat bilan (yoki umuman
 * qiymatsiz) qurilgan bo'lsa, brauzerda TURN BO'LMAYDI — server tomonda TURN
 * mukammal ishlayotgan bo'lsa ham. Bu jim degradatsiya edi; endi ko'rsatamiz.
 */
export function getIceConfigError(): string | null {
  return iceConfigError;
}

export function isTurnConfigured(): boolean {
  if (iceTurnConfigured !== null) return iceTurnConfigured;
  const envTurn = process.env.NEXT_PUBLIC_TURN_URL;
  // MUHIM: manzil BORLIGI yetarli emas — u brauzer yeta oladigan manzil
  // bo'lishi kerak. `turn:localhost:3478` boshqa qurilmada o'sha qurilmaning
  // o'zini bildiradi, ya'ni TURN aslida yo'q.
  return !!envTurn && isBrowserReachableTurnUrl(envTurn);
}

function buildEnvIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [...DEFAULT_ICE];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnPass = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  // Yaroqsiz TURN manzilini RO'YXATGA QO'SHMAYMIZ. Aks holda brauzer uni
  // sinab, har safar bir necha soniya kutadi va biz uni "TURN bor" deb
  // hisoblab, aslida hech qachon ishlamaydigan relay'ga tayanib qolamiz.
  if (turnUrl && isBrowserReachableTurnUrl(turnUrl)) {
    servers.push({
      urls: turnUrl,
      username: turnUser || undefined,
      credential: turnPass || undefined,
    });
  }

  const extra = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (extra) {
    try {
      const parsed = JSON.parse(extra) as RTCIceServer[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* default */
    }
  }

  return servers;
}

/** ICE serverlar — avval API dan, keyin env fallback */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  if (cachedIceServers) return cachedIceServers;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      // Bearer token ham yuboramiz. Ilgari faqat cookie'ga tayanardi — cookie
      // yo'q yoki SameSite tufayli yuborilmagan holatda endpoint 401 qaytarardi
      // va biz JIMGINA STUN-only rejimga tushardik. Aynan shu holatda TURN
      // sozlangan bo'lsa ham brauzer undan foydalanmaydi.
      const token = api.getToken();
      const res = await fetch('/api/video/ice-config', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        iceConfigError = `ICE konfiguratsiyasini olishda xatolik (HTTP ${res.status})`;
      }
      if (res.ok) {
        const data = (await res.json()) as { iceServers?: RTCIceServer[]; turnConfigured?: boolean };
        if (data.iceServers?.length) {
          cachedIceServers = data.iceServers;
          iceTurnConfigured = data.turnConfigured ?? data.iceServers.some((s) => {
            const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
            return urls.some((u) => String(u).startsWith('turn:'));
          });
          return cachedIceServers;
        }
      }
    } catch (err) {
      iceConfigError = `ICE konfiguratsiyasiga ulanib bo'lmadi (${String(err)})`;
    }

    cachedIceServers = buildEnvIceServers();
    iceTurnConfigured = cachedIceServers.some((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return urls.some((u) => String(u).startsWith('turn:'));
    });
    if (iceConfigError && !iceTurnConfigured) {
      iceConfigError +=
        ' — zaxira sozlamada ham TURN yo\'q. Web image NEXT_PUBLIC_TURN_URL bilan qayta qurilishi kerak.';
    }
    return cachedIceServers;
  })();

  return fetchPromise;
}

/** Sync fallback — peer yaratishdan oldin fetchIceServers() chaqiring */
export function getIceServers(): RTCIceServer[] {
  return cachedIceServers ?? buildEnvIceServers();
}

export function clearIceCache() {
  cachedIceServers = null;
  iceTurnConfigured = null;
  fetchPromise = null;
  iceConfigError = null;
}
