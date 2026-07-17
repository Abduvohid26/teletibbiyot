export const WS_VIDEO_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Socket.IO HTTP path (nginx /socket.io/ proxy bilan mos) */
export const SOCKET_IO_PATH = process.env.NEXT_PUBLIC_SOCKET_IO_PATH || '/socket.io';

function normalizeHttpBase(url: string): string {
  return url
    .replace(/^ws:/, 'http:')
    .replace(/^wss:/, 'https:')
    .replace(/\/$/, '');
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(normalizeHttpBase(url)).hostname;
  } catch {
    return null;
  }
}

function isLocalhostHostname(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1';
}

/** Docker ichki hostnamelari — brauzer ularni hech qachon hal qila olmaydi. */
function isDockerInternalHost(host: string): boolean {
  return host === 'api' || host === 'web';
}

function resolveWsBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const host = apiUrl ? hostnameOf(apiUrl) : null;

    if (apiUrl && host && !isDockerInternalHost(host)) {
      // localhost/127.0.0.1 — faqat sahifaning O'ZI ham localhost'da bo'lsa ishlatamiz
      // (lokal dev): u holda brauzer API ga to'g'ridan-to'g'ri ulanadi. Prod'da (ishifo.uz)
      // "localhost" foydalanuvchining o'z mashinasini bildiradi — u yerda same-origin
      // (nginx /socket.io proxy) ishlatiladi.
      if (!isLocalhostHostname(host) || isLocalhostHostname(window.location.hostname)) {
        return normalizeHttpBase(apiUrl);
      }
    }
    return window.location.origin;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) return normalizeHttpBase(apiUrl);

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (wsUrl) return normalizeHttpBase(wsUrl);

  return normalizeHttpBase(WS_VIDEO_URL);
}

/** Socket.IO namespace URL — brauzer to'g'ridan-to'g'ri API ga ulanadi (WS proxy muammosiz) */
export function getSocketIoUrl(): string {
  return `${resolveWsBaseUrl()}/video`;
}

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface CameraFeed {
  id: string;
  label: string;
  type: 'patient' | 'room' | 'doctor' | 'equipment';
  ptz?: boolean;
  crop?: { x: number; y: number; w: number; h: number };
}

/** UT muassasasidagi 4 ta kamera — MT tomonda ko'rinadi */
export const UT_CAMERA_FEEDS: CameraFeed[] = [
  { id: 'main', label: "Asosiy ko'rinish", type: 'room', crop: { x: 0, y: 0, w: 1, h: 1 } },
  { id: 'close', label: 'Bemor yaqindan', type: 'patient', ptz: true, crop: { x: 0.28, y: 0.12, w: 0.44, h: 0.55 } },
  { id: 'room', label: "Xona ko'rinishi", type: 'room', crop: { x: 0, y: 0, w: 1, h: 0.72 } },
  { id: 'equipment', label: 'Qurilmalar', type: 'equipment', crop: { x: 0.05, y: 0.45, w: 0.9, h: 0.55 } },
];

export const MT_DOCTOR_STREAM_ID = 'mt-doctor';

/** WebRTC track tartibi — birinchi oqim bemor kamerasi (close) */
export const UT_CAMERA_ORDER = ['close', 'main', 'room', 'equipment'] as const;
