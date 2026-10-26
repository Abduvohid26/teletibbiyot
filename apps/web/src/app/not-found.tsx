'use client';

import { ArrowLeft, Home, LayoutDashboard, LogIn } from 'lucide-react';
import { ErrorScreen, type ErrorScreenAction } from '@/components/ui/ErrorScreen';
import { useAuth } from '@/lib/auth-context';
import { getRoleHomePath } from '@/lib/auth-utils';
import { useI18n } from '@/i18n';

export default function NotFound() {
  const { t } = useI18n();
  const { user, hydrated } = useAuth();

  // Tizimga kirgan — o'z kabinetiga; mehmon — bosh sahifa yoki login
  const actions: ErrorScreenAction[] =
    hydrated && user
      ? [{ label: t('errors.goCabinet'), href: getRoleHomePath(user.role), icon: LayoutDashboard, primary: true }]
      : [
          { label: t('errors.goLanding'), href: '/', icon: Home, primary: true },
          { label: t('errors.signIn'), href: '/login', icon: LogIn },
        ];
  actions.push({ label: t('errors.goBack'), onClick: () => window.history.back(), icon: ArrowLeft });

  return (
    <ErrorScreen
      code="404"
      title={t('errors.notFoundTitle')}
      body={t('errors.notFoundBody')}
      hint={t('errors.notFoundHint')}
      actions={actions}
    />
  );
}
