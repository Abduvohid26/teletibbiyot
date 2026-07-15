'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { UtShell } from '@/components/ut/UtShell';
import { UtPatientList } from '@/components/ut/UtPatientList';
import { UtPatientSwitcher } from '@/components/ut/UtPatientSwitcher';
import { useUtSessions } from '@/hooks/use-ut-sessions';

export default function UtPatientsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const {
    consultation,
    sessions,
    inProgressList,
    error,
    switchToConsultation,
    refreshSessions,
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
      pageTitle="Bemorlar ro'yxati"
      pageSubtitle="Navbatdagi va jonli efirdagi bemorlar"
      pageAction={
        <div className="flex items-center gap-1.5">
          {error && (
            <button
              type="button"
              onClick={() => void refreshSessions()}
              className="ut-glass-btn !text-[10px] !py-1 !px-2"
            >
              Yangilash
            </button>
          )}
          <Link href="/ut" className="gradient-btn !text-[10px] !py-1.5 !px-2.5 inline-flex items-center gap-1">
            <UserPlus size={12} /> Qabul
          </Link>
        </div>
      }
      headerExtra={
        sessions.length > 0 ? (
          <UtPatientSwitcher
            activeId={consultation?.id}
            sessions={sessions}
            onSelect={switchToConsultation}
            className="!min-w-0 !max-w-[200px] !py-1.5 !px-2"
          />
        ) : null
      }
    >
      <div className="ut-page">
        {error && (
          <div className="shrink-0 mb-2 text-[11px] text-red-700 ut-glass-banner border-red-200/70 bg-red-50/75 px-3 py-1.5">
            {error}
          </div>
        )}

        <UtPatientList
          sessions={sessions}
          activeId={consultation?.id}
          onSelect={switchToConsultation}
          showGoLive
          sessionCount={sessions.length}
          liveCount={inProgressList.length}
        />
      </div>
    </UtShell>
  );
}
