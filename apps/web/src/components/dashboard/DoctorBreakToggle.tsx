'use client';

import { Coffee, Loader2 } from 'lucide-react';
import { useDoctorBreak } from '@/hooks/use-doctor-break';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

/**
 * Shifokor tanaffus holatini boshqaradi. Holat serverda (User.onBreak) saqlanadi,
 * shuning uchun UT operator shifokorlar ro'yxatida darhol "Tanaffus" ko'radi.
 */
export function DoctorBreakToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const { isDoctor, onBreak, saving, toggle } = useDoctorBreak();

  if (!isDoctor) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-pressed={onBreak}
      title={onBreak ? t('presence.endBreak') : t('presence.goOnBreak')}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg p-2 text-xs font-semibold transition-colors disabled:opacity-50',
        onBreak
          ? 'bg-orange-400 text-brand-950 hover:bg-orange-300'
          : 'text-slate-300 hover:bg-white/10 hover:text-white',
        className,
      )}
    >
      {saving ? <Loader2 size={15} className="animate-spin" /> : <Coffee size={15} />}
      {onBreak && <span className="hidden md:inline">{t('presence.endBreak')}</span>}
    </button>
  );
}
