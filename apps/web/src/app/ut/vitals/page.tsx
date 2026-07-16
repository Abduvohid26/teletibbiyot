'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Stethoscope, Radio, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { UtShell } from '@/components/ut/UtShell';
import { UtQuickNav } from '@/components/ut/UtNavTabs';
import { UtConsultationSession } from '@/components/video/UtConsultationSession';
import { UtDocumentsModal } from '@/components/ut/UtDocumentsModal';
import { UtLiveQueuePanel, UtQueueCountPill } from '@/components/ut/UtLiveQueuePanel';
import { UtLiveQueueDrawer, UtMobileQueueFab } from '@/components/ut/UtLiveQueueDrawer';
import { useUtSessions } from '@/hooks/use-ut-sessions';

export default function UtVitalsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showDocuments, setShowDocuments] = useState(false);
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const {
    consultation,
    sessions,
    inProgressList,
    queuedList,
    error,
    liveBanner,
    setLiveBanner,
    switchToConsultation,
    cancelSession,
  } = useUtSessions(!!user && isUtRole(user?.role || ''));

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (user && !isUtRole(user.role)) router.replace(getRoleHomePath(user.role));
  }, [user, loading, router]);

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
            : consultation.mtDoctor?.fullName || undefined
          : undefined
      }
      pageAction={
        consultation || queuedList.length > 0 ? (
          <div className="flex items-center gap-2 shrink-0">
            <UtQueueCountPill count={queuedList.length} />
            {consultation && (
              <button
                type="button"
                onClick={() => setShowDocuments(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/90 text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200 transition-colors"
              >
                <FileText size={13} />
                Hujjatlar
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="ut-page pb-14 lg:pb-0">
        {error && (
          <div className="shrink-0 mb-2 ut-glass-banner border-red-200/70 bg-red-50/75 text-red-700 text-xs px-3 py-1.5">
            {error}
          </div>
        )}

        {liveBanner && (
          <div className="shrink-0 mb-2 ut-glass-banner-live animate-fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <Radio size={15} className="text-emerald-600 animate-pulse shrink-0" />
              <p className="text-sm font-semibold text-emerald-900 truncate">
                Shifokor qabul qildi{liveBanner.doctorName ? ` — ${liveBanner.doctorName}` : ''}. Jonli efir boshlandi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLiveBanner(null)}
              className="text-xs text-emerald-700 font-bold px-2 py-0.5 rounded-md bg-emerald-100 shrink-0"
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
              <p className="text-sm text-slate-500 max-w-xs">
                Bemorlar ro&apos;yxatidan tanlang yoki yangi qabul qiling
              </p>
            </div>
            <UtQuickNav sessionCount={sessions.length} liveCount={inProgressList.length} />
            <Link href="/ut" className="gradient-btn !text-sm">Bemor qabul qilish</Link>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex gap-2 lg:gap-3 overflow-hidden">
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
              <UtConsultationSession
                key={consultation.id}
                consultation={consultation}
                patientName={consultation.patient.fullName}
              />
            </div>

            {sessions.length > 0 && (
              <UtLiveQueuePanel
                activeId={consultation.id}
                sessions={sessions}
                onSelect={switchToConsultation}
                onCancel={(id) => void cancelSession(id)}
                className="hidden lg:flex w-[220px] xl:w-[248px] shrink-0"
              />
            )}
          </div>
        )}

        {consultation && (
          <UtDocumentsModal
            open={showDocuments}
            onClose={() => setShowDocuments(false)}
            consultationId={consultation.id}
            patientName={consultation.patient.fullName}
          />
        )}
      </div>

      {sessions.length > 0 && (
        <>
          <UtMobileQueueFab
            queuedCount={queuedList.length}
            sessionCount={sessions.length}
            onOpen={() => setQueueDrawerOpen(true)}
          />
          <UtLiveQueueDrawer
            open={queueDrawerOpen}
            onClose={() => setQueueDrawerOpen(false)}
            activeId={consultation?.id}
            sessions={sessions}
            onSelect={switchToConsultation}
            onCancel={(id) => void cancelSession(id)}
          />
        </>
      )}
    </UtShell>
  );
}
