'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Stethoscope, Radio } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { UtShell } from '@/components/ut/UtShell';
import { UtPatientSwitcher } from '@/components/ut/UtPatientSwitcher';
import { UtConsultationSession } from '@/components/video/UtConsultationSession';
import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { useUtSessions } from '@/hooks/use-ut-sessions';
import { toast } from '@/lib/toast';

export default function UtVitalsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const {
    consultation,
    sessions,
    inProgressList,
    error,
    liveBanner,
    setLiveBanner,
    switchToConsultation,
  } = useUtSessions(!!user && isUtRole(user?.role || ''));

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (user && !isUtRole(user.role)) router.replace(getRoleHomePath(user.role));
  }, [user, loading, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.search.includes('submitted=1')) return;
    toast('Bemor navbatga qo\'shildi', 'success');
    router.replace('/ut/vitals', { scroll: false });
  }, [router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-slate-500 animate-pulse">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <UtShell
      sessionCount={sessions.length}
      liveCount={inProgressList.length}
      headerExtra={
        sessions.length > 0 ? (
          <UtPatientSwitcher
            activeId={consultation?.id}
            sessions={sessions}
            onSelect={switchToConsultation}
          />
        ) : null
      }
    >
      <div className="h-full w-full flex flex-col min-h-0 p-2 sm:p-3 gap-2">
        {error && (
          <div className="shrink-0 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
        )}

        {liveBanner && (
          <div className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <Radio size={16} className="text-emerald-600 animate-pulse shrink-0" />
              <p className="text-sm font-semibold text-emerald-900 truncate">
                Jonli efir boshlandi{liveBanner.doctorName ? ` — ${liveBanner.doctorName}` : ''}
              </p>
            </div>
            <button type="button" onClick={() => setLiveBanner(null)} className="text-xs text-emerald-700 font-semibold shrink-0">
              OK
            </button>
          </div>
        )}

        {!consultation ? (
          <div className="flex-1 panel flex flex-col items-center justify-center p-6 text-center">
            <Stethoscope className="w-10 h-10 text-slate-300 mb-2" />
            <h2 className="font-semibold text-slate-800 mb-1">Faol bemor yo&apos;q</h2>
            <p className="text-xs text-slate-500 mb-4 max-w-xs">
              Bemor ma&apos;lumotlarini kiriting yoki ro&apos;yxatdan tanlang
            </p>
            <div className="flex gap-2">
              <Link href="/ut" className="gradient-btn !text-xs !py-2">Qabul qilish</Link>
              <Link href="/ut/patients" className="btn-secondary !text-xs !py-2">Bemorlar</Link>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
              <UtConsultationSession
                key={consultation.id}
                consultation={consultation}
                patientName={consultation.patient.fullName}
              />
            </div>
            <details className="shrink-0 panel !rounded-lg overflow-hidden group">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 list-none flex items-center justify-between">
                Hujjatlar
                <span className="text-[10px] font-normal text-slate-400 group-open:hidden">Ko&apos;rish</span>
              </summary>
              <div className="border-t border-slate-100 max-h-40 overflow-y-auto">
                <AttachmentManager
                  consultationId={consultation.id}
                  allowUpload
                  onChange={() => void switchToConsultation(consultation.id)}
                />
              </div>
            </details>
          </div>
        )}
      </div>
    </UtShell>
  );
}
