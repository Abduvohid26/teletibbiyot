'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { UtShell } from '@/components/ut/UtShell';
import { UtPatientList } from '@/components/ut/UtPatientList';
import { useUtSessions } from '@/hooks/use-ut-sessions';

export default function UtPatientsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const {
    consultation,
    sessions,
    inProgressList,
    switchToConsultation,
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
    <UtShell sessionCount={sessions.length} liveCount={inProgressList.length}>
      <div className="h-full max-w-6xl mx-auto p-3 sm:p-4 flex flex-col min-h-0">
        <div className="shrink-0 mb-3">
          <h1 className="text-base font-bold text-slate-900">Bemorlar</h1>
          <p className="text-xs text-slate-500">Navbat va jonli efirdagi bemorlar ro&apos;yxati</p>
        </div>
        <UtPatientList
          sessions={sessions}
          activeId={consultation?.id}
          onSelect={switchToConsultation}
          showGoLive
        />
      </div>
    </UtShell>
  );
}
