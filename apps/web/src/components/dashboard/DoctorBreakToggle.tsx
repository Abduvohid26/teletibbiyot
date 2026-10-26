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
        'ut-glass-btn !p-2 shrink-0 disabled:opacity-50',
        onBreak
          ? 'text-orange-600 !bg-orange-50/80 hover:!bg-orange-100/80'
          : 'text-slate-500 hover:!text-slate-700',
        className,
      )}
    >
      {saving ? <Loader2 size={15} className="animate-spin" /> : <Coffee size={15} />}
    </button>
  );
}
