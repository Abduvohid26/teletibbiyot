import type { Locale } from './locales';
import uz from './dictionaries/uz';
import ru from './dictionaries/ru';
import en from './dictionaries/en';

export type MessageTree = { [key: string]: string | MessageTree };

const DICTS: Record<Locale, MessageTree> = { uz, ru, en };

function lookup(tree: MessageTree, path: string): string | undefined {
  const parts = path.split('.');
  let cur: string | MessageTree | undefined = tree;
  for (const part of parts) {
    if (!cur || typeof cur === 'string') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** `t('nav.patients', { count: 3 })` — `{count}` o'rniga qiymat */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const raw =
    lookup(DICTS[locale], key)
    ?? lookup(DICTS.uz, key)
    ?? key;

  if (!params) return raw;
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    raw,
  );
}

export function getDictionary(locale: Locale): MessageTree {
  return DICTS[locale] ?? DICTS.uz;
}
