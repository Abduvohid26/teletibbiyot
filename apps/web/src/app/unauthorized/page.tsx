'use client';

import { LayoutDashboard, LogIn } from 'lucide-react';
import { ErrorScreen, type ErrorScreenAction } from '@/components/ui/ErrorScreen';
import { useAuth } from '@/lib/auth-context';
import { getRoleHomePath } from '@/lib/auth-utils';
import { useI18n } from '@/i18n';

export default function UnauthorizedPage() {
  const { user, hydrated, logout } = useAuth();
  const { t } = useI18n();

  const actions: ErrorScreenAction[] =
    hydrated && user
      ? [
          { label: t('errors.goCabinet'), href: getRoleHomePath(user.role), icon: LayoutDashboard, primary: true },
          { label: t('errors.switchAccount'), onClick: () => void logout(), icon: LogIn },
        ]
      : [{ label: t('errors.signIn'), href: '/login', icon: LogIn, primary: true }];

  return (
    <ErrorScreen
      code="403"
      title={t('errors.unauthorized')}
      body={t('errors.unauthorizedBody')}
      hint={t('errors.unauthorizedHint')}
      actions={actions}
    />
  );
}
