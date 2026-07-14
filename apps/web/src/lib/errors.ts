/** Markazlashtirilgan xato qayta ishlash — barcha UI qatlami shu moduldan foydalanadi */

export class AppError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toUserMessage(err: unknown, fallback = 'Xatolik yuz berdi'): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

/** Ixtiyoriy fon operatsiyalar — xatoni yutmaydi, dev rejimida log qiladi */
export async function safeAsync<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[safeAsync:${label}]`, err);
    }
    return fallback;
  }
}
