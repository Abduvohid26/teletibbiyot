'use client';

import { useCallback, useEffect, useState } from 'react';
import { Coffee, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

/**
 * Shifokor tanaffus holatini boshqaradi. Holat serverda (User.onBreak) saqlanadi,
 * shuning uchun UT operator shifokorlar ro'yxatida darhol "Tanaffus" ko'radi.
 */
export function DoctorBreakToggle({ className }: { className?: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [onBreak, setOnBreak] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDoctor = user?.role === 'MT_DOCTOR';

  // Boshlang'ich holatni shifokorlar ro'yxatidan olamiz (alohida endpoint kerak emas)
  useEffect(() => {
    if (!isDoctor || !user?.id) return;
    let cancelled = false;
    api
      .getDoctors()
      .then((doctors) => {
        if (cancelled) return;
        const me = doctors.find((d) => d.id === user.id);
        if (me) setOnBreak(me.presence === 'break');
      })
      .catch(() => {
        /* header tugmasi uchun jim o'tamiz */
      });
    return () => {
      cancelled = true;
    };
  }, [isDoctor, user?.id]);

  const toggle = useCallback(async () => {
    if (saving) return;
    const next = !onBreak;
    setSaving(true);
    try {
      await api.setMyBreak(next);
      setOnBreak(next);
      toast(next ? t('presence.onBreakNotice') : t('presence.endBreak'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  }, [onBreak, saving, t]);

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
