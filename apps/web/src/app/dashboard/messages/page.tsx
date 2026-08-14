'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { AuthPageGate } from '@/components/auth/AuthLoadingScreen';
import { api, AppNotification } from '@/lib/api';
import { getRoleHomePath, isUtRole, canAccessMtDashboard } from '@/lib/auth-utils';
import { Bell, CheckCheck } from 'lucide-react';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { useI18n } from '@/i18n';
import { LOCALE_BCP47 } from '@/i18n/locales';

export default function MessagesPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user, loading, authError, retryAuth } = useRequireAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.getNotifications()
      .then(setNotifications)
      .catch((err) => setError(err instanceof Error ? err.message : t('errors.generic')));
  }, [t]);

  useConsultationRealtime([], {
    onConsultationStarted: () => load(),
    onConsultationCompleted: () => load(),
    onAttachmentUploaded: () => load(),
    onAiUpdated: () => load(),
  }, { staffFeed: true });

  useEffect(() => {
    if (loading || !user) return;
    load();
  }, [user, loading, load]);

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener('consultation-started', onRefresh);
    window.addEventListener('consultation-completed', onRefresh);
    return () => {
      window.removeEventListener('consultation-started', onRefresh);
      window.removeEventListener('consultation-completed', onRefresh);
    };
  }, [load]);

  const markAll = async () => {
    try {
      await api.markAllNotificationsRead();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.updateError'));
    }
  };

  const openNotification = async (n: AppNotification) => {
    if (!n.read) {
      try {
        await api.markNotificationRead(n.id);
      } catch {
        /* mark-read is optional */
      }
    }
    if (n.consultationId && user) {
      if (isUtRole(user.role)) {
        sessionStorage.setItem('ishifo_ut_active_consultation', n.consultationId);
        router.push('/ut/vitals');
      } else if (canAccessMtDashboard(user.role)) {
        router.push('/dashboard/consultations');
      } else {
        router.push(getRoleHomePath(user.role));
      }
    }
    load();
  };

  return (
    <AuthPageGate loading={loading} user={user} authError={authError} retryAuth={retryAuth}>
      <DashboardLayout title={t('messages.title')}>
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-slate-500">{t('messages.subtitle')}</p>
          <button type="button" onClick={markAll} className="btn-secondary !text-xs">
            <CheckCheck size={14} /> {t('messages.markAllRead')}
          </button>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3 mb-4">{error}</div>}
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openNotification(n)}
              className={`panel p-4 flex gap-3 w-full text-left transition-colors hover:border-brand-200 ${n.read ? 'opacity-70' : 'border-brand-200 bg-brand-50/30'}`}
            >
              <Bell size={18} className={n.read ? 'text-slate-400' : 'text-brand-600 shrink-0 mt-0.5'} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{n.title}</p>
                <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>
                <p className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString(LOCALE_BCP47[locale])}</p>
              </div>
              {!n.read && (
                <span className="text-xs text-brand-600 shrink-0 self-center">
                  {t('messages.unread')}
                </span>
              )}
            </button>
          ))}
          {notifications.length === 0 && (
            <div className="panel p-10 text-center text-slate-400 text-sm">{t('messages.empty')}</div>
          )}
        </div>
      </DashboardLayout>
    </AuthPageGate>
  );
}
