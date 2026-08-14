import { getIceServers, isTurnConfigured } from '@/lib/video-config';

export interface TurnPreflightResult {
  /** TURN umuman sozlanganmi (konfiguratsiya darajasida) */
  configured: boolean;
  /** TURN serverdan HAQIQIY relay candidate keldimi */
  relayAvailable: boolean;
  /** Tekshiruv o'tkazildimi (brauzer qo'llab-quvvatlamasa false) */
  checked: boolean;
}

let cached: TurnPreflightResult | null = null;
let cachedAt = 0;
let inFlight: Promise<TurnPreflightResult> | null = null;

/** Muvaffaqiyatli tekshiruv uzoqroq, muvaffaqiyatsiz — qisqa (sekin net false-negative) */
const POSITIVE_TTL_MS = 10 * 60 * 1000;
const NEGATIVE_TTL_MS = 20 * 1000;

/**
 * TURN serverga real ulanishni tekshiradi.
 *
 * `isTurnConfigured()` faqat konfiguratsiya BORLIGINI aytadi — TURN serverning
 * o'zi o'chiq, port yopiq yoki parol noto'g'ri bo'lsa ham "true" qaytaradi.
 * Bu yerda bo'sh RTCPeerConnection bilan candidate yig'ib, `typ relay`
 * candidate kelishini kutamiz. Kelmasa — turli tarmoqlardagi (simmetrik NAT)
 * shifokor va UT operator BIR-BIRINI KO'RA OLMAYDI, va buni 30 soniyalik qora
 * ekrandan keyin emas, qo'ng'iroq boshida aytish kerak.
 */
export async function checkTurnReachable(timeoutMs = 10000): Promise<TurnPreflightResult> {
  if (cached) {
    const ttl = cached.relayAvailable ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
    if (Date.now() - cachedAt < ttl) return cached;
    cached = null;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const configured = isTurnConfigured();
    if (!configured || typeof RTCPeerConnection === 'undefined') {
      return { configured, relayAvailable: false, checked: false };
    }

    let pc: RTCPeerConnection | null = null;
    try {
      // iceTransportPolicy: 'relay' — faqat TURN orqali candidate yig'iladi,
      // shuning uchun bitta candidate kelishining o'zi TURN ishlayotganini bildiradi.
      pc = new RTCPeerConnection({ iceServers: getIceServers(), iceTransportPolicy: 'relay' });
      const peer = pc;

      const relayAvailable = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        };

        const timer = setTimeout(() => finish(false), timeoutMs);

        peer.onicecandidate = (event) => {
          if (!event.candidate) {
            // Yig'ish tugadi va bironta ham relay candidate kelmadi.
            finish(false);
            return;
          }
          if (event.candidate.candidate.includes(' typ relay')) finish(true);
        };
        peer.onicegatheringstatechange = () => {
          if (peer.iceGatheringState === 'complete') finish(false);
        };

        peer.createDataChannel('turn-preflight');
        peer
          .createOffer()
          .then((offer) => peer.setLocalDescription(offer))
          .catch(() => finish(false));
      });

      return { configured, relayAvailable, checked: true };
    } catch {
      return { configured, relayAvailable: false, checked: false };
    } finally {
      pc?.close();
    }
  })();

  cached = await inFlight;
  cachedAt = Date.now();
  inFlight = null;
  return cached;
}

export function clearTurnPreflightCache() {
  cached = null;
  cachedAt = 0;
  inFlight = null;
}
