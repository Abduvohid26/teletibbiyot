/**
 * Meet-uslubidagi video xona: refreshdan keyin avtomatik qayta kirish.
 * Explicit Leave yoki room-closed da tozalanadi.
 */

const KEY_PREFIX = 'video-room:';
/** Konsultatsiya ochiq qolsa ham session 12 soatdan oshmasin */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

type SessionRole = 'mt' | 'ut' | 'observe';

interface VideoRoomSession {
  joined: true;
  role: SessionRole;
  ts: number;
}

function storageKey(consultationId: string) {
  return `${KEY_PREFIX}${consultationId}`;
}

function readSession(consultationId: string): VideoRoomSession | null {
  if (typeof window === 'undefined' || !consultationId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(consultationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VideoRoomSession;
    if (!parsed?.joined || !parsed.ts) return null;
    if (Date.now() - parsed.ts > MAX_AGE_MS) {
      sessionStorage.removeItem(storageKey(consultationId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Shu xonada oldin Join qilinganmi (refresh auto-rejoin uchun) */
export function wasJoined(consultationId: string | undefined): boolean {
  if (!consultationId) return false;
  return readSession(consultationId) !== null;
}

export function markJoined(consultationId: string, role: SessionRole) {
  if (typeof window === 'undefined' || !consultationId) return;
  const payload: VideoRoomSession = { joined: true, role, ts: Date.now() };
  try {
    sessionStorage.setItem(storageKey(consultationId), JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}

export function clearJoined(consultationId: string | undefined) {
  if (typeof window === 'undefined' || !consultationId) return;
  try {
    sessionStorage.removeItem(storageKey(consultationId));
  } catch {
    /* ignore */
  }
}

/** Boshqa konsultatsiyaga o'tganda eski sessionni tozalash */
export function clearOtherJoined(keepConsultationId?: string) {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) keys.push(key);
    }
    const keep = keepConsultationId ? storageKey(keepConsultationId) : null;
    for (const key of keys) {
      if (key !== keep) sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
