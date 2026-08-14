'use client';

import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getRoleHomePath } from '@/lib/auth-utils';
import { useI18n } from '@/i18n';

export default function UnauthorizedPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const home = user ? getRoleHomePath(user.role) : '/login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 text-red-600 mb-4">
          <ShieldOff size={28} />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">{t('errors.unauthorized')}</h1>
        <p className="text-slate-600 text-sm mb-6">
          {t('errors.unauthorizedBody')}
        </p>
        <Link href={home} className="btn-primary inline-block">
          {t('errors.goHome')}
        </Link>
      </div>
    </div>
  );
}
