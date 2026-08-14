export const LOCALES = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'uz';

export const LOCALE_COOKIE = 'ishifo_locale';
export const LOCALE_STORAGE_KEY = 'ishifo.locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

/** Segmentli switcher uchun qisqa yorliqlar (doim bir xil ko‘rinish) */
export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  uz: "O'z",
  ru: 'Ру',
  en: 'En',
};

export const LOCALE_BCP47: Record<Locale, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): Locale {
  if (isLocale(value)) return value;
  if (typeof value === 'string') {
    const base = value.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Brauzerdagi saqlangan til — React tashqarisidagi modullar uchun */
export function getClientLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const fromStorage = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (fromStorage) return normalizeLocale(fromStorage);
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  if (match?.[1]) return normalizeLocale(decodeURIComponent(match[1]));
  return DEFAULT_LOCALE;
}
