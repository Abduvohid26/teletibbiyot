'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Stethoscope, LogOut, Activity, UserPlus, Radio } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { api, Consultation } from '@/lib/api';
import { UT_ACTIVE_CONSULTATION_KEY } from '@/lib/api/constants';
import { UtConsultationSession } from '@/components/video/UtConsultationSession';
import { ConsultationSwitcher } from '@/components/dashboard/ConsultationSwitcher';
import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { UtSessionStatusBanner } from '@/components/ut/UtSessionStatusBanner';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { toast } from '@/lib/toast';

export default function UtVitalsPage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [sessions, setSessions] = useState<Consultation[]>([]);
  const [error, setError] = useState('');
  const [liveBanner, setLiveBanner] = useState<{ doctorName?: string } | null>(null);

  const inProgressList = useMemo(
    () => sessions.filter((c) => c.status === 'IN_PROGRESS'),
    [sessions],
  );
  const queuedList = useMemo(
    () => sessions.filter((c) => c.status === 'QUEUED'),
    [sessions],
  );

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (user && !isUtRole(user.role)) router.replace(getRoleHomePath(user.role));
  }, [user, loading, router]);

  const refreshSessions = () => {
    api.getUtSessionConsultations().then(setSessions).catch(() => setSessions([]));
  };

  const load = (preferredId?: string) => {
    const preferred =
      preferredId
      || (typeof window !== 'undefined'
        ? sessionStorage.getItem(UT_ACTIVE_CONSULTATION_KEY) || undefined
        : undefined);
    api
      .getUtActiveConsultation(preferred)
      .then((c) => {
        setConsultation(c);
        if (c?.id && typeof window !== 'undefined') {
          sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, c.id);
        }
        refreshSessions();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik'));
  };

  const switchToConsultation = (consultationId: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(UT_ACTIVE_CONSULTATION_KEY, consultationId);
    }
    api
      .getUtActiveConsultation(consultationId)
      .then((c) => {
        setConsultation(c);
        refreshSessions();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik'));
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.search.includes('submitted=1')) return;
    toast('Bemor navbatga qo\'shildi — shifokor qabul qilguncha kuting', 'success');
    router.replace('/ut/vitals', { scroll: false });
  }, [router]);

  const realtimeIds = useMemo(
    () => sessions.map((c) => c.id).slice(0, 12),
    [sessions],
  );

  useConsultationRealtime(
    realtimeIds,
    {
      onConsultationQueued: () => load(),
      onConsultationStarted: (payload) => {
        const name = payload.doctorName || 'Shifokor';
        setLiveBanner({ doctorName: name });
        toast(`${name} jonli efirni boshladi`, 'success');
        if (payload.consultationId) {
          switchToConsultation(payload.consultationId);
        } else {
          load();
        }
      },
      onConsultationCompleted: () => load(),
      onAttachmentAnalyzed: () => load(),
      onAiUpdated: () => load(),
    },
    { staffFeed: true, notifyToasts: true },
  );

  useEffect(() => {
    const onStarted = (e: Event) => {
      const detail = (e as CustomEvent<{ consultationId?: string; doctorName?: string }>).detail;
      const name = detail?.doctorName || 'Shifokor';
      setLiveBanner({ doctorName: name });
      toast(`${name} jonli efirni boshladi`, 'success');
      if (detail?.consultationId) {
        switchToConsultation(detail.consultationId);
      } else {
        load();
      }
    };
    window.addEventListener('consultation-started', onStarted);
    return () => window.removeEventListener('consultation-started', onStarted);
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-slate-500 animate-pulse">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-4 py-2">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-brand-600 flex items-center justify-center shrink-0">
              <Radio size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-900 text-sm truncate">Jonli efir</h1>
              <p className="text-[11px] text-slate-500 truncate">{user.facility?.name}</p>
            </div>
          </div>

          {sessions.length > 0 && (
            <ConsultationSwitcher
              variant="inline"
              activeId={consultation?.id}
              myInProgress={inProgressList}
              queued={queuedList}
              onSelect={switchToConsultation}
              onStart={switchToConsultation}
              queuedActionLabel="Ko'rish"
            />
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <Link href="/ut" className="btn-secondary !py-1.5 !text-xs inline-flex items-center gap-1">
              <UserPlus size={13} /> Yangi bemor
            </Link>
            <button type="button" onClick={logout} className="btn-ghost !p-1.5 text-red-500" aria-label="Chiqish">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{error}</div>
        )}

        <UtSessionStatusBanner
          consultation={consultation}
          sessionCount={sessions.length}
          liveJustStarted={!!liveBanner}
          doctorName={liveBanner?.doctorName}
          onDismissLive={() => setLiveBanner(null)}
        />

        {!consultation ? (
          <div className="panel p-8 text-center">
            <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h2 className="font-semibold text-slate-800 mb-2">Hozircha faol bemor yo&apos;q</h2>
            <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
              Avval bemor ma&apos;lumotlarini kiriting. Yuborilgandan keyin shu yerda video va vital uzatiladi.
            </p>
            <Link href="/ut" className="gradient-btn inline-flex items-center gap-2">
              <Stethoscope size={16} /> Bemor ma&apos;lumotlari
            </Link>
          </div>
        ) : (
          <>
            <UtConsultationSession
              key={consultation.id}
              consultation={consultation}
              patientName={consultation.patient.fullName}
            />

            <AttachmentManager
              consultationId={consultation.id}
              allowUpload
              onChange={() => load(consultation.id)}
            />
          </>
        )}
      </main>
    </div>
  );
}
