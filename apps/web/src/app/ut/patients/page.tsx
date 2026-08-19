'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isUtRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { UtPatientList } from '@/components/ut/UtPatientList';
import { useUtSessions } from '@/hooks/use-ut-sessions';
import { useI18n } from '@/i18n';

export default function UtPatientsPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const {
    consultation,
    sessions,
    patientConsultations,
    inProgressList,
    error,
    switchToConsultation,
    refreshAll,
  } = useUtSessions(!!user && isUtRole(user?.role || ''));

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (user && !isUtRole(user.role)) router.replace(getRoleHomePath(user.role));
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-slate-500 animate-pulse">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="ut-page">
      {error && (
        <div className="shrink-0 mb-2 text-xs text-red-700 ut-glass-banner border-red-200/70 bg-red-50/75 px-3 py-1.5 flex items-center justify-between gap-2">
          <span className="truncate">{error}</span>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="text-[10px] font-semibold underline shrink-0"
          >
            {t('common.refresh')}
          </button>
        </div>
      )}

      <UtPatientList
        sessions={patientConsultations.length > 0 ? patientConsultations : sessions}
        activeId={consultation?.id}
        onSelect={switchToConsultation}
        showGoLive
        sessionCount={sessions.length}
        liveCount={inProgressList.length}
      />
    </div>
  );
}
