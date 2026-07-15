'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Stethoscope, Radio, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { UtShell } from '@/components/ut/UtShell';
import { UtPatientSwitcher } from '@/components/ut/UtPatientSwitcher';
import { UtQuickNav } from '@/components/ut/UtNavTabs';
import { UtConsultationSession } from '@/components/video/UtConsultationSession';
import { AttachmentManager } from '@/components/attachments/AttachmentManager';
import { useUtSessions } from '@/hooks/use-ut-sessions';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

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
      pageTitle={consultation?.patient.fullName}
      pageSubtitle={
        consultation
          ? consultation.status === 'IN_PROGRESS'
            ? `Jonli efir · ${consultation.mtDoctor?.fullName || 'Shifokor'}`
            : 'Navbatda — shifokor boshlaguncha kameraga tayyor turing'
          : undefined
      }
      pageAction={
        consultation ? (
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
              consultation.status === 'IN_PROGRESS'
                ? 'bg-emerald-100/90 text-emerald-700 ring-1 ring-emerald-200/60'
                : 'bg-amber-100/90 text-amber-800 ring-1 ring-amber-200/60',
            )}
          >
            {consultation.status === 'IN_PROGRESS' ? '● Jonli' : '○ Navbat'}
          </span>
        ) : undefined
      }
      headerExtra={
        sessions.length > 0 ? (
          <UtPatientSwitcher
            activeId={consultation?.id}
            sessions={sessions}
            onSelect={switchToConsultation}
            className="!min-w-0 !max-w-[220px] !py-1.5 !px-2"
          />
        ) : null
      }
    >
      <div className="ut-page">
        {error && (
          <div className="shrink-0 mb-2 ut-glass-banner border-red-200/70 bg-red-50/75 text-red-700 text-[11px] px-3 py-1.5">
            {error}
          </div>
        )}

        {liveBanner && (
          <div className="shrink-0 mb-2 ut-glass-banner-live animate-fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <Radio size={15} className="text-emerald-600 animate-pulse shrink-0" />
              <p className="text-xs font-semibold text-emerald-900 truncate">
                Jonli efir boshlandi{liveBanner.doctorName ? ` — ${liveBanner.doctorName}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLiveBanner(null)}
              className="text-[10px] text-emerald-700 font-bold px-2 py-0.5 rounded-md bg-emerald-100 shrink-0"
            >
              OK
            </button>
          </div>
        )}

        {!consultation ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0 text-center p-4">
            <div className="ut-glass-empty">
              <Stethoscope className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm mb-1">Faol bemor tanlanmagan</h2>
              <p className="text-xs text-slate-500 max-w-xs">
                Avval bemor qabul qiling yoki ro&apos;yxatdan tanlang
              </p>
            </div>
            <UtQuickNav sessionCount={sessions.length} liveCount={inProgressList.length} />
            <Link href="/ut" className="gradient-btn !text-xs">Bemor qabul qilish</Link>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-hidden">
              <UtConsultationSession
                key={consultation.id}
                consultation={consultation}
                patientName={consultation.patient.fullName}
              />
            </div>

            <details className="shrink-0 mt-1.5 ut-glass-details group">
              <summary className="cursor-pointer px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white/40 list-none flex items-center gap-2">
                <FileText size={13} className="text-slate-400" />
                Hujjatlar
                <span className="ml-auto text-[10px] font-normal text-slate-400 group-open:hidden">Ochish</span>
              </summary>
              <div className="border-t border-slate-100 max-h-28 overflow-hidden">
                <AttachmentManager
                  consultationId={consultation.id}
                  allowUpload
                  onChange={() => void switchToConsultation(consultation.id)}
                />
              </div>
            </details>
          </>
        )}
      </div>
    </UtShell>
  );
}
