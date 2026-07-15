'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Stethoscope, ArrowLeft, LogOut, Activity } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { UserRole, isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { api, Consultation } from '@/lib/api';
import { UT_ACTIVE_CONSULTATION_KEY } from '@/lib/api/constants';
import { UtConsultationSession } from '@/components/video/UtConsultationSession';
import { ConsultationSwitcher } from '@/components/dashboard/ConsultationSwitcher';
import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { formatStatus } from '@/lib/utils';
import { toast } from '@/lib/toast';

export default function UtVitalsPage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [inProgressList, setInProgressList] = useState<Consultation[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (user && !isUtRole(user.role)) router.replace(getRoleHomePath(user.role));
  }, [user, loading, router]);

  const refreshInProgress = () => {
    api.getUtInProgressConsultations().then(setInProgressList).catch(() => setInProgressList([]));
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
        refreshInProgress();
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
        refreshInProgress();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik'));
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  useConsultationRealtime(
    consultation?.id ? [consultation.id] : [],
    {
      onConsultationQueued: () => load(),
      onConsultationStarted: (payload) => {
        if (payload.consultationId) {
          switchToConsultation(payload.consultationId);
          return;
        }
        load();
      },
      onAttachmentAnalyzed: () => load(),
      onAiUpdated: () => load(),
    },
    { staffFeed: true, notifyToasts: true },
  );

  useEffect(() => {
    const onStarted = (e: Event) => {
      const detail = (e as CustomEvent<{ consultationId?: string; doctorName?: string }>).detail;
      const name = detail?.doctorName || 'Shifokor';
      toast(`${name} konsultatsiyani boshladi — video ulanishni kuting`, 'success');
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

  const status = consultation ? formatStatus(consultation.status) : null;

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/ut" className="btn-ghost !p-2">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="font-bold text-slate-900 tracking-tight">Jonli video va vital</h1>
              <p className="text-xs text-slate-500">{user.facility?.name}</p>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost text-red-500 hover:text-red-600 hover:bg-red-50">
            <LogOut size={16} /> Chiqish
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-4 animate-fade-in">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5">{error}</div>
        )}

        {!consultation ? (
          <div className="panel p-10 text-center">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="font-semibold text-slate-800 mb-2">Faol konsultatsiya yo&apos;q</h2>
            <p className="text-sm text-slate-500 mb-6">
              Bemor qabul qiling — keyin shu yerda video va vital ko&apos;rsatkichlarni uzatishingiz mumkin.
            </p>
            <Link href="/ut" className="btn-primary inline-flex">
              <Stethoscope size={16} /> Bemor qabul qilish
            </Link>
          </div>
        ) : (
          <>
            <div className="panel p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{consultation.patient.fullName}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Shifokor: {consultation.mtDoctor?.fullName || 'Navbatda kutmoqda...'}
                </p>
              </div>
              <span className={`status-badge ${status?.className}`}>{status?.label}</span>
            </div>

            {inProgressList.length > 1 && (
              <ConsultationSwitcher
                activeId={consultation.id}
                myInProgress={inProgressList}
                queued={[]}
                onSelect={switchToConsultation}
                onStart={switchToConsultation}
              />
            )}

            <UtConsultationSession key={consultation.id} consultation={consultation} />

            <AttachmentManager
              consultationId={consultation.id}
              allowUpload
              onChange={load}
            />
          </>
        )}
      </main>
    </div>
  );
}
