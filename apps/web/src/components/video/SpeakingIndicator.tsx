'use client';

import { Mic } from 'lucide-react';
import type { ActiveSpeaker } from '@/hooks/use-livekit-room';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

/**
 * "Kim gapiryapti" — ism va ROLI bilan (UT operator / mas'ul / konsilium / siz).
 * Bir nechta odam gapirsa — eng baland ovozlisi va "+N".
 */
export function SpeakingIndicator({
  speakers,
  leadDoctorId,
  className,
}: {
  speakers?: ActiveSpeaker[];
  leadDoctorId?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const list = speakers ?? [];
  if (!list.length) return null;
  // Boshqa odam gapirayotgan bo'lsa — o'sha muhimroq ("Siz gapiryapsiz" dan oldin)
  const top = list.find((sp) => !sp.isLocal) ?? list[0];
  const label = speakerLabel(top, leadDoctorId, t);
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none inline-flex max-w-[90%] items-center gap-1.5 rounded-full bg-emerald-600/95 px-3 py-1 text-xs font-semibold text-white shadow-lg ring-1 ring-white/20',
        className,
      )}
    >
      <Mic size={13} className="shrink-0 animate-pulse" />
      <span className="truncate">{label}</span>
      {list.length > 1 && <span className="shrink-0 opacity-80">+{list.length - 1}</span>}
    </div>
  );
}

export function speakerLabel(
  s: ActiveSpeaker,
  leadDoctorId: string | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (s.isLocal) return t('video.youSpeaking');
  const name = s.name || t('common.doctor');
  if (s.role === 'ut') return t('video.speakingAs', { name, role: t('video.roleUt') });
  const role = leadDoctorId && s.id === leadDoctorId ? t('video.leadTag') : t('video.consiliumTag');
  return t('video.speakingAs', { name, role });
}

/** Gapirayotganlar userId to'plami — oynalarni yashil hoshiya bilan ajratish uchun */
export function speakingIds(speakers?: ActiveSpeaker[]) {
  return new Set((speakers ?? []).map((s) => s.id));
}
