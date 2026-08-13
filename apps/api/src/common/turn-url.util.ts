/** Brauzer ulanishi mumkin bo'lgan TURN manzillarni ajratish (Docker ichki hostname emas) */
import {
  describeTurnUrlProblem,
  extractTurnHostname,
  isBrowserReachableTurnUrl,
} from '@ishifo/shared';

// Validatsiya mantig'i @ishifo/shared da — brauzer ham AYNAN shu qoidani
// ishlatishi shart, aks holda web "TURN sozlangan" deb o'ylab, aslida
// yaroqsiz manzilga ulanishga urinadi.
export { describeTurnUrlProblem, extractTurnHostname, isBrowserReachableTurnUrl };

export function resolvePublicTurnUrl(
  config: { get: (key: string) => string | undefined },
): string | undefined {
  const candidates = [
    config.get('TURN_PUBLIC_URL'),
    config.get('NEXT_PUBLIC_TURN_URL'),
    config.get('TURN_URL'),
  ].filter((v): v is string => !!v?.trim());

  return candidates.find(isBrowserReachableTurnUrl);
}

/** Sozlash xatolarini ishga tushirishda BALAND aytish uchun */
export function diagnoseTurnConfig(
  config: { get: (key: string) => string | undefined },
): { ok: boolean; problems: string[] } {
  const keys = ['TURN_PUBLIC_URL', 'NEXT_PUBLIC_TURN_URL', 'TURN_URL'];
  const problems: string[] = [];

  const present = keys
    .map((key) => ({ key, value: config.get(key)?.trim() }))
    .filter((e): e is { key: string; value: string } => !!e.value);

  if (!present.length) {
    return { ok: false, problems: ['TURN manzili umuman sozlanmagan (TURN_PUBLIC_URL yo\'q)'] };
  }

  if (present.some((e) => isBrowserReachableTurnUrl(e.value))) {
    return { ok: true, problems: [] };
  }

  for (const { key, value } of present) {
    const problem = describeTurnUrlProblem(value);
    if (problem) problems.push(`${key}=${value} → ${problem}`);
  }
  return { ok: false, problems };
}
