'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, Consultation } from '@/lib/api';
import { UT_ACTIVE_CONSULTATION_KEY } from '@/lib/api/constants';
import { fetchUtSessionConsultations } from '@/lib/ut-sessions-fetch';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { toast } from '@/lib/toast';
import { isInLiveCall, onMediaLeftFor } from '@/lib/video-socket-client';
import { wasJoined } from '@/lib/video-room-session';
import { UT_SELECT_EVENT } from '@/hooks/use-ut-header-data';
import { selfCancelledConsultations } from '@/hooks/use-cancel-consultation';
import { useI18n } from '@/i18n';

export function useUtSessions(enabled = true) {
  const { t } = useI18n();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [sessions, setSessions] = useState<Consultation[]>([]);
  const [patientConsultations, setPatientConsultations] = useState<Consultation[]>([]);
  const [error, setError] = useState('');
  const [liveBanner, setLiveBanner] = useState<{ doctorName?: string } | null>(null);
  // Birinchi yuklash tugaguncha ro'yxat "bo'sh" deb ko'rsatilmasin
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [patientsLoaded, setPatientsLoaded] = useState(false);

  // Realtime handler'lar eskirgan closure'dan emas, joriy ro'yxatdan o'qisin
  const sessionsRef = useRef<Consultation[]>([]);
  /** Yakunlangan, lekin operator hali ichida turgan xona (Meet qoidasi) */
  const lingerRef = useRef<string | null>(null);
  sessionsRef.current = sessions;

  /** Faqat shu operatorning bemori bo'lsa — yakun/bekor haqida xabar */
  const notifyFinished = useCallback((consultationId: string, kind: 'completed' | 'cancelled') => {
    const mine = sessionsRef.current.find((c) => c.id === consultationId);
    if (!mine) return;
    // "Shifokor qabul qildi — jonli efir boshlandi" banneri endi eskirgan
    setLiveBanner(null);
    if (kind === 'cancelled') selfCancelledConsultations.delete(consultationId);
    // "Tashxis tayyor" / "Bekor qilindi" xabari server bildirishnomasi sifatida
    // keladi (ovoz + qo'ng'iroqchada saqlanadi) — bu yerda takrorlanmaydi
  }, []);

  const inProgressList = useMemo(
    () => sessions.filter((c) => c.status === 'IN_PROGRESS'),
    [sessions],
  );
  const queuedList = useMemo(
    () => sessions.filter((c) => c.status === 'QUEUED'),
    [sessions],
  );

  const refreshSessions = useCallback(() => {
    return fetchUtSessionConsultations()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoaded(true));
  }, []);

  const refreshPatientConsultations = useCallback(() => {
    return api
      .getUtPatientConsultations()
      .then(setPatientConsultations)
      .catch(() => setPatientConsultations([]))
      .finally(() => setPatientsLoaded(true));
  }, []);

  const refreshAll = useCallback(() => {
    return Promise.all([refreshSessions(), refreshPatientConsultations()]);
  }, [refreshSessions, refreshPatientConsultations]);

  const load = useCallback((preferredId?: string) => {
    const preferred =
      preferredId
      || (typeof window !== 'undefined'
        ? sessionStorage.getItem(UT_ACTIVE_CONSULTATION_KEY) || undefined
        : undefined);
    return api
      .getUtActiveConsultation(preferred)
      .then((c) => {
        // So'rov davomida boshqa bemor tanlangan bo'lsa (masalan operator yangi
        // bemorni hozirgina yubordi) — eskirgan javob bilan uni BOSIB KETMAYMIZ.
        // Aks holda "Jonli efir" yangi emas, oldingi bemorning xonasini ochardi.
        const current = typeof window !== 'undefined'
          ? sessionStorage.getItem(UT_ACTIVE_CONSULTATION_KEY)
          : null;
        if (current && current !== (preferred ?? null) && current !== c?.id) {
          refreshSessions();
          return c;
        }
        // Operator yakunlangan xonada gaplashib turibdi — faol bemorni almashtirmaymiz
        if (lingerRef.current && isInLiveCall(lingerRef.current)) {
          refreshSessions();
          return c;
        }
        // F5: operator yakunlangan (lekin hali odam bor) xonada edi — o'sha xonaga qaytadi.
        // Xona yopilgan bo'lsa server rad etadi va sessiya oddiy holatga qaytadi.
        if (preferred && c?.id !== preferred && wasJoined(preferred) && lingerRef.current !== preferred) {
          return api
            .getConsultation(preferred)
            .then((done) => {
              if (done.status !== 'COMPLETED') throw new Error('not-completed');
              lingerRef.current = preferred;
              setLingerId(preferred);
              setConsultation(done);
              refreshSessions();
              return done;
            })
            .catch(() => {
              setConsultation(c);
              if (c?.id) sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, c.id);
              refreshSessions();
              refreshPatientConsultations();
              return c;
            });
        }
        setConsultation(c);
        if (c?.id && typeof window !== 'undefined') {
          sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, c.id);
        }
        refreshSessions();
        refreshPatientConsultations();
        return c;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Xatolik');
        return null;
      });
  }, [refreshSessions, refreshPatientConsultations]);

  const switchToConsultation = useCallback((consultationId: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, consultationId);
    }
    return api
      .getUtActiveConsultation(consultationId)
      .then((c) => {
        setConsultation(c);
        refreshSessions();
        refreshPatientConsultations();
        return c;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Xatolik');
        return null;
      });
  }, [refreshSessions, refreshPatientConsultations]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    void refreshPatientConsultations();
  }, [enabled, load, refreshPatientConsultations]);

  const realtimeIds = useMemo(
    () => sessions.map((c) => c.id).slice(0, 12),
    [sessions],
  );

  // Yakunlangan xonadan operator chiqdi — endi ro'yxat/faol bemor yangilanadi
  const [lingerId, setLingerId] = useState<string | null>(null);
  useEffect(() => {
    if (!lingerId) return;
    return onMediaLeftFor(lingerId, () => {
      lingerRef.current = null;
      setLingerId(null);
      void load();
      void refreshPatientConsultations();
    });
  }, [lingerId, load, refreshPatientConsultations]);

  useConsultationRealtime(
    enabled ? realtimeIds : [],
    {
      onConsultationQueued: () => void load(),
      onConsultationStarted: (payload) => {
        const name = payload.doctorName || payload.mtDoctorName || t('common.doctor');
        setLiveBanner({ doctorName: name });
        // "Shifokor sizni kutmoqda" — server bildirishnomasi kiruvchi qo'ng'iroq bo'lib jiringlaydi
        if (payload.consultationId) {
          // Optimistic status — API round-tripdan oldin UI yangilansin
          setSessions((prev) =>
            prev.map((c) =>
              c.id === payload.consultationId
                ? {
                    ...c,
                    status: 'IN_PROGRESS',
                    mtDoctor: c.mtDoctor
                      ?? (payload.mtDoctorId
                        ? { id: payload.mtDoctorId, fullName: name }
                        : undefined),
                  }
                : c,
            ),
          );
          setConsultation((prev) =>
            prev?.id === payload.consultationId
              ? {
                  ...prev,
                  status: 'IN_PROGRESS',
                  mtDoctor: prev.mtDoctor
                    ?? (payload.mtDoctorId
                      ? { id: payload.mtDoctorId, fullName: name }
                      : undefined),
                }
              : prev,
          );
          void switchToConsultation(payload.consultationId);
        } else {
          void load();
        }
      },
      onConsultationCompleted: ({ consultationId }) => {
        notifyFinished(consultationId, 'completed');
        // Meet qoidasi: operator hali shu xonada gaplashayotgan bo'lsa — uni boshqa
        // bemorga otib yubormaymiz; chiqqanida (MEDIA_PRESENCE_EVENT) yangilanadi
        if (isInLiveCall(consultationId)) {
          lingerRef.current = consultationId;
          setLingerId(consultationId);
          setConsultation((prev) => (prev?.id === consultationId ? { ...prev, status: 'COMPLETED' } : prev));
          void refreshSessions();
          return;
        }
        void load();
        void refreshPatientConsultations();
      },
      onConsultationCancelled: ({ consultationId }) => {
        notifyFinished(consultationId, 'cancelled');
        void load();
        void refreshPatientConsultations();
      },
      onAttachmentAnalyzed: () => void load(),
      onAiUpdated: () => void load(),
    },
    // UT operator uchun toastlar o'chirilgan: bu hook /ut sahifasida ikkinchi realtime
    // obunachi bo'lib, har bir event ikki marta xabar berardi
    { staffFeed: true, notifyToasts: false },
  );

  useEffect(() => {
    if (!enabled) return;
    const onStarted = (e: Event) => {
      const detail = (e as CustomEvent<{ consultationId?: string; doctorName?: string }>).detail;
      const name = detail?.doctorName || 'Shifokor';
      setLiveBanner({ doctorName: name });
      // Toast YO'Q: bu window hodisasini har bir realtime hook nusxasi yuboradi
      // (sahifada 3 ta) — xabar onConsultationStarted'da bir marta chiqadi.
      if (detail?.consultationId) {
        void switchToConsultation(detail.consultationId);
      } else {
        void load();
      }
    };
    window.addEventListener('consultation-started', onStarted);
    return () => window.removeEventListener('consultation-started', onStarted);
  }, [enabled, load, switchToConsultation]);

  useEffect(() => {
    if (!enabled) return;
    const onSelect = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) void switchToConsultation(id);
    };
    window.addEventListener(UT_SELECT_EVENT, onSelect);
    return () => window.removeEventListener(UT_SELECT_EVENT, onSelect);
  }, [enabled, switchToConsultation]);

  const applyAfterCancel = useCallback(async (consultationId: string) => {
    if (typeof window !== 'undefined') {
      const active = sessionStorage.getItem(UT_ACTIVE_CONSULTATION_KEY);
      if (active === consultationId) {
        sessionStorage.removeItem(UT_ACTIVE_CONSULTATION_KEY);
      }
    }
    if (consultation?.id === consultationId) {
      setConsultation(null);
    }
    await refreshSessions();
    const remaining = await fetchUtSessionConsultations();
    setSessions(remaining);
    const next = remaining[0];
    if (next) {
      await switchToConsultation(next.id);
    }
  }, [consultation?.id, refreshSessions, switchToConsultation]);

  const cancelSession = useCallback(async (consultationId: string, reason: string) => {
    selfCancelledConsultations.add(consultationId);
    await api.cancelConsultation(consultationId, reason).catch((err) => {
      selfCancelledConsultations.delete(consultationId);
      throw err;
    });
    await applyAfterCancel(consultationId);
    toast.info(t('utToast.cancelled'));
  }, [applyAfterCancel]);

  return {
    consultation,
    sessions,
    inProgressList,
    queuedList,
    error,
    setError,
    liveBanner,
    setLiveBanner,
    load,
    switchToConsultation,
    cancelSession,
    applyAfterCancel,
    refreshSessions,
    refreshPatientConsultations,
    refreshAll,
    patientConsultations,
    loaded: sessionsLoaded && patientsLoaded,
  };
}
