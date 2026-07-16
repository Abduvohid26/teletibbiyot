'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { UtShell } from '@/components/ut/UtShell';
import { UtAnalyticsContent } from '@/components/ut/UtAnalyticsContent';
import { useUtSessions } from '@/hooks/use-ut-sessions';

export default function UtAnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { sessions, inProgressList } = useUtSessions(!!user && isUtRole(user?.role || ''));

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
      pageTitle="Analitika"
      pageSubtitle="UT bo'yicha statistika va hisobotlar"
    >
      <div className="ut-page overflow-y-auto pb-4">
        <UtAnalyticsContent />
      </div>
    </UtShell>
  );
}
