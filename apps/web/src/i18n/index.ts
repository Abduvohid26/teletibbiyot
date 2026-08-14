export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
  LOCALE_BCP47,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  isLocale,
  normalizeLocale,
  getClientLocale,
  type Locale,
} from './locales';
export { translate, getDictionary } from './translate';

import { translate } from './translate';
import { getClientLocale } from './locales';

/** React tashqarisida joriy UI tilida tarjima */
export function translateClient(
  key: string,
  params?: Record<string, string | number>,
): string {
  return translate(getClientLocale(), key, params);
}
export { I18nProvider, useI18n, useOptionalI18n } from './I18nProvider';
export { LanguageSwitcher } from './LanguageSwitcher';
