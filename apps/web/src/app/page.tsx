'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getRoleHomePath } from '@/lib/auth-utils';
import { useI18n } from '@/i18n';

/** Hard fallback — agar client router ishlamasa ham login ga o'tsin */
const HARD_REDIRECT_MS = 8000;

export default function HomePage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;

    if (!loading) {
      redirected.current = true;
      const target = user ? getRoleHomePath(user.role) : '/login';
      router.replace(target);
      // App Router ba'zan soft navigate qilib qotadi — hard fallback
      const t = setTimeout(() => {
        if (window.location.pathname === '/') {
          window.location.replace(target);
        }
      }, 1500);
      return () => clearTimeout(t);
    }

    const hard = setTimeout(() => {
      if (redirected.current) return;
      redirected.current = true;
      window.location.replace('/login');
    }, HARD_REDIRECT_MS);
    return () => clearTimeout(hard);
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="animate-pulse text-slate-400 text-sm">{t('common.loading')}</div>
    </div>
  );
}
