/**
 * iShifo — yagona toast tizimi (barcha rollar uchun).
 *
 *   toast.success('Saqlandi')
 *   toast.error('Yuborib bo‘lmadi', { description: err.message, action: { label: 'Qayta', onClick: retry } })
 *   const id = toast.loading('Yuborilmoqda…'); toast.update(id, { type: 'success', title: 'Yuborildi' })
 *   await toast.promise(api.save(), { loading: '…', success: 'Saqlandi', error: (e) => e.message })
 *
 * Eski chaqiruv ham ishlaydi: toast(message, 'error').
 * Holat modul darajasida saqlanadi — <ToastProvider> keyin mount bo'lsa ham xabar yo'qolmaydi.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Berilsa — shu id'li toast yangilanadi (takrorlanmaydi) */
  id?: string;
  description?: string;
  /** ms; `Infinity` — foydalanuvchi yopguncha */
  duration?: number;
  action?: ToastAction;
}

export interface ToastRecord {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
  action?: ToastAction;
  /** Har yangilanishda o'zgaradi — taymer qaytadan boshlanadi */
  version: number;
  leaving?: boolean;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  info: 5000,
  warning: 6500,
  error: 8000,
  loading: Infinity,
};

/** Bir vaqtda ko'rinadigan maksimal soni — eskilari yopiladi */
const MAX_VISIBLE = 4;
/** Bir xil xabar qisqa vaqt ichida takrorlansa (bir nechta realtime obunachi) — bittasi yetarli */
const DEDUPE_MS = 4000;
const LEAVE_MS = 180;

let toasts: ToastRecord[] = [];
const listeners = new Set<() => void>();
const recent = new Map<string, number>();
let counter = 0;

function emit() {
  for (const l of listeners) l();
}

function set(next: ToastRecord[]) {
  toasts = next;
  emit();
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts() {
  return toasts;
}

const EMPTY: ToastRecord[] = [];
export function getServerToasts() {
  return EMPTY;
}

function isDuplicate(type: ToastType, title: string, description?: string) {
  if (type === 'loading') return false;
  const key = `${type}:${title}:${description ?? ''}`;
  const now = Date.now();
  const last = recent.get(key);
  recent.set(key, now);
  if (recent.size > 50) {
    for (const [k, at] of recent) if (now - at >= DEDUPE_MS) recent.delete(k);
  }
  return !!last && now - last < DEDUPE_MS;
}

function show(type: ToastType, title: string, opts: ToastOptions = {}): string {
  if (typeof window === 'undefined') return '';

  const existing = opts.id ? toasts.find((x) => x.id === opts.id) : undefined;
  if (existing) {
    update(existing.id, { type, title, ...opts });
    return existing.id;
  }
  if (isDuplicate(type, title, opts.description)) return opts.id ?? '';

  const record: ToastRecord = {
    id: opts.id ?? `t${Date.now().toString(36)}${(counter++).toString(36)}`,
    type,
    title,
    description: opts.description,
    duration: opts.duration ?? DEFAULT_DURATION[type],
    action: opts.action,
    version: 0,
  };

  const active = toasts.filter((x) => !x.leaving);
  const overflow = active.length + 1 - MAX_VISIBLE;
  if (overflow > 0) active.slice(0, overflow).forEach((x) => dismiss(x.id));
  set([...toasts, record]);
  return record.id;
}

export function update(id: string, patch: Partial<Omit<ToastRecord, 'id' | 'version'>>) {
  let found = false;
  const next = toasts.map((x) => {
    if (x.id !== id) return x;
    found = true;
    const type = patch.type ?? x.type;
    return {
      ...x,
      ...patch,
      type,
      // Turi o'zgarsa (loading → success) — o'sha turning odatiy muddati
      duration: patch.duration ?? (patch.type && patch.type !== x.type ? DEFAULT_DURATION[type] : x.duration),
      version: x.version + 1,
      leaving: false,
    };
  });
  if (found) set(next);
}

/** id berilmasa — hammasi yopiladi */
export function dismiss(id?: string) {
  const targets = toasts.filter((x) => (id ? x.id === id : true) && !x.leaving);
  if (targets.length === 0) return;
  const ids = new Set(targets.map((x) => x.id));
  set(toasts.map((x) => (ids.has(x.id) ? { ...x, leaving: true } : x)));
  setTimeout(() => set(toasts.filter((x) => !(ids.has(x.id) && x.leaving))), LEAVE_MS);
}

type Resolvable<T> = string | ((value: T) => string);

function resolve<T>(v: Resolvable<T>, value: T) {
  return typeof v === 'function' ? v(value) : v;
}

async function promise<T>(
  p: Promise<T>,
  msgs: { loading: string; success: Resolvable<T>; error: Resolvable<unknown>; description?: string },
): Promise<T> {
  const id = show('loading', msgs.loading, { description: msgs.description });
  try {
    const value = await p;
    update(id, { type: 'success', title: resolve(msgs.success, value), description: undefined });
    return value;
  } catch (err) {
    update(id, { type: 'error', title: resolve(msgs.error, err), description: undefined });
    throw err;
  }
}

type LegacyType = 'success' | 'error' | 'info' | 'warning';

/** Eski API: toast(message, type) — yoki toast(title, { ...options, type }) */
function toastFn(title: string, typeOrOptions?: LegacyType | (ToastOptions & { type?: ToastType })) {
  if (typeof typeOrOptions === 'string' || typeOrOptions === undefined) {
    return show(typeOrOptions ?? 'info', title);
  }
  const { type = 'info', ...opts } = typeOrOptions;
  return show(type, title, opts);
}

export const toast = Object.assign(toastFn, {
  success: (title: string, opts?: ToastOptions) => show('success', title, opts),
  error: (title: string, opts?: ToastOptions) => show('error', title, opts),
  warning: (title: string, opts?: ToastOptions) => show('warning', title, opts),
  info: (title: string, opts?: ToastOptions) => show('info', title, opts),
  loading: (title: string, opts?: ToastOptions) => show('loading', title, opts),
  update,
  dismiss,
  promise,
});
