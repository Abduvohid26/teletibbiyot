export type ToastType = 'success' | 'error' | 'info';

/** Bir xil xabar qisqa vaqt ichida takrorlansa (bir nechta realtime obunachi) — bittasi yetarli */
const DEDUPE_MS = 4000;
const recent = new Map<string, number>();

export function toast(message: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return;
  const key = `${type}:${message}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUPE_MS) return;
  recent.set(key, now);
  if (recent.size > 50) {
    for (const [k, at] of recent) if (now - at >= DEDUPE_MS) recent.delete(k);
  }
  window.dispatchEvent(new CustomEvent('ishifo-toast', { detail: { message, type } }));
}
