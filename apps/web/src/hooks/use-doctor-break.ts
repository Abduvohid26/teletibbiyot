'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/i18n';

const BREAK_EVENT = 'doctor-break-changed';

/**
 * Shifokor tanaffus holati (serverda User.onBreak). Header tugmasi va bo'sh
 * navbat ekrani bir xil holatni ko'rsatishi uchun o'zgarish window hodisasi
 * orqali tarqatiladi.
 */
export function useDoctorBreak() {
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
        /* holat noma'lum bo'lsa "online" deb qoldiramiz */
      });
    return () => {
      cancelled = true;
    };
  }, [isDoctor, user?.id]);

  useEffect(() => {
    const onChanged = (e: Event) => setOnBreak(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(BREAK_EVENT, onChanged);
    return () => window.removeEventListener(BREAK_EVENT, onChanged);
  }, []);

  const setBreak = useCallback(async (next: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await api.setMyBreak(next);
      window.dispatchEvent(new CustomEvent(BREAK_EVENT, { detail: next }));
      toast(next ? t('presence.onBreakNotice') : t('presence.endBreak'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  }, [saving, t]);

  const toggle = useCallback(() => setBreak(!onBreak), [onBreak, setBreak]);

  return { isDoctor, onBreak, saving, toggle, setBreak };
}
