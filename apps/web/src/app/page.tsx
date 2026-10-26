'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getRoleHomePath } from '@/lib/auth-utils';
import { LandingPage } from '@/components/landing/LandingPage';

/** Mehmonlar uchun landing; tizimga kirgan foydalanuvchi o'z kabinetiga o'tadi */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    const target = getRoleHomePath(user.role);
    router.replace(target);
    // App Router ba'zan soft navigate qilib qotadi — hard fallback
    const t = setTimeout(() => {
      if (window.location.pathname === '/') window.location.replace(target);
    }, 1500);
    return () => clearTimeout(t);
  }, [user, loading, router]);

  return <LandingPage />;
}
