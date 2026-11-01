/**
 * iShifo ovozlari — Web Audio bilan sintez qilinadi (fayl yuklanmaydi, internet
 * sekin bo'lsa ham darhol chalinadi).
 *
 *   playSound('chime')      — oddiy bildirishnoma
 *   playSound('alert')      — favqulodda / muhim
 *   startRingtone('call')   — kiruvchi qo'ng'iroq (stopRingtone() gacha takrorlanadi)
 *
 * Brauzer ovozni foydalanuvchi sahifaga birinchi marta bosguncha bloklaydi —
 * `installAudioUnlock()` shu birinchi bosishda AudioContext'ni ochib qo'yadi.
 */

export type SoundKind = 'chime' | 'alert';
export type RingtoneKind = 'call' | 'urgent';

const STORAGE_KEY = 'ishifo-sound-enabled';
const VOLUME = 0.22;

let ctx: AudioContext | null = null;
let ringTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* private mode */
  }
  if (!enabled) stopRingtone();
  listeners.forEach((l) => l());
}

export function subscribeSoundSetting(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Birinchi bosish/klavishda ovozni "ochib" qo'yadi (autoplay siyosati) */
export function installAudioUnlock() {
  if (typeof window === 'undefined') return () => {};
  const unlock = () => {
    const c = getContext();
    if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

/** Bitta nota: yumshoq hujum va so'nish bilan */
function tone(
  c: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = VOLUME,
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function ready(): AudioContext | null {
  if (!isSoundEnabled()) return null;
  const c = getContext();
  if (!c) return null;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  return c;
}

export function playSound(kind: SoundKind) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.02;
  if (kind === 'chime') {
    // Ikki notali yoqimli "ding-dong"
    tone(c, 880, t, 0.35);
    tone(c, 1318.5, t + 0.14, 0.5);
    return;
  }
  // Favqulodda: uch marta qisqa, sezilarli signal
  for (let i = 0; i < 3; i++) {
    tone(c, 988, t + i * 0.22, 0.16, 'square', VOLUME * 0.55);
    tone(c, 1480, t + i * 0.22 + 0.08, 0.1, 'square', VOLUME * 0.4);
  }
}

function ringOnce(kind: RingtoneKind) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.02;
  if (kind === 'urgent') {
    for (let i = 0; i < 4; i++) {
      tone(c, i % 2 ? 1175 : 880, t + i * 0.25, 0.22, 'triangle', VOLUME);
    }
    return;
  }
  // Telefon qo'ng'irog'iga o'xshash: ko'tariluvchi uch nota, ikki marta
  const notes = [659.25, 783.99, 1046.5];
  for (let r = 0; r < 2; r++) {
    notes.forEach((f, i) => tone(c, f, t + r * 0.6 + i * 0.13, 0.28, 'sine', VOLUME));
  }
}

/** Kiruvchi qo'ng'iroq ovozi — stopRingtone() chaqirilguncha takrorlanadi */
export function startRingtone(kind: RingtoneKind = 'call') {
  stopRingtone();
  ringOnce(kind);
  ringTimer = setInterval(() => ringOnce(kind), kind === 'urgent' ? 1600 : 2600);
}

export function stopRingtone() {
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = null;
  }
}
