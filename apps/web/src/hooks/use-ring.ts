'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, AppNotification } from '@/lib/api';
import { NOTIFICATION_EVENT } from '@/components/notifications/NotificationProvider';
import { toast } from '@/lib/toast';
import { useI18n } from '@/i18n';

/** Javob kutish vaqti — qabul qiluvchidagi jiringlash vaqti bilan bir xil */
const RING_MS = 45_000;

/**
 * Xonaga qo'ng'iroq qilish (chaqiruvchi tomoni). Chaqirilgan odam xonaga kirsa
 * (`inRoom` ichida paydo bo'lsa) yoki vaqt tugasa — "chaqirilmoqda" holati tugaydi.
 */
export function useRing(consultationId: string | undefined, inRoom: Set<string>) {
  const { t } = useI18n();
  const [ringing, setRinging] = useState<string[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setRinging(null);
  }, []);

  useEffect(() => stop, [consultationId, stop]);

  // Chaqirilgan odam "Hozir emas" dedi (toastni provider ko'rsatadi)
  useEffect(() => {
    if (!ringing || !consultationId) return;
    const onNotif = (e: Event) => {
      const n = (e as CustomEvent<AppNotification>).detail;
      if (n?.type === 'room_call_declined' && n.consultationId === consultationId) stop();
    };
    window.addEventListener(NOTIFICATION_EVENT, onNotif);
    return () => window.removeEventListener(NOTIFICATION_EVENT, onNotif);
  }, [ringing, consultationId, stop]);

  // Chaqirilgan odam xonaga kirdi
  useEffect(() => {
    if (ringing?.some((id) => inRoom.has(id))) stop();
  }, [inRoom, ringing, stop]);

  const ring = useCallback(
    async (targetUserId?: string) => {
      if (!consultationId) return;
      try {
        const res = await api.ringConsultationRoom(consultationId, targetUserId);
        if (!res.rung.length) {
          toast.info(res.alreadyInRoom.length ? t('ring.alreadyInRoom') : t('ring.recently'));
          return;
        }
        setRinging(res.rung);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          setRinging(null);
          toast.warning(t('ring.noAnswer'), { description: t('ring.noAnswerHint') });
        }, RING_MS);
      } catch (err) {
        toast.error(t('ring.error'), { description: err instanceof Error ? err.message : undefined });
      }
    },
    [consultationId, t],
  );

  return { ring, ringing: !!ringing, ringingIds: ringing ?? [], stop };
}
