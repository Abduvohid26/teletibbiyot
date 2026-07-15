'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { UtShell } from '@/components/ut/UtShell';
import { UtPatientSwitcher } from '@/components/ut/UtPatientSwitcher';
import { SettingsContent } from '@/components/settings/SettingsContent';
import { useUtSessions } from '@/hooks/use-ut-sessions';

export default function UtSettingsPage() {
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
    <UtShell
      sessionCount={sessions.length}
      liveCount={inProgressList.length}
      pageTitle="Sozlamalar"
      pageSubtitle="Profil va video sozlamalari"
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
        <SettingsContent user={user} videoRole="ut" compact />
      </div>
    </UtShell>
  );
}
