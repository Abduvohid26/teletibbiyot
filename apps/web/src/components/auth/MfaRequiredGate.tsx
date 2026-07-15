'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@ishifo/shared';

const MFA_EXEMPT_PATHS = ['/login', '/unauthorized', '/privacy', '/terms', '/open-data'];

function roleRequiresMfa(role: string): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_E2E === 'true') return false;
  const raw = process.env.NEXT_PUBLIC_MFA_REQUIRED_ROLES || '';
  const roles = raw.split(',').map((r) => r.trim()).filter(Boolean);
  if (!roles.length) return false;
  return roles.includes(role);
}

export function MfaRequiredGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (user.mfaEnabled) return;
    if (!roleRequiresMfa(user.role)) return;
    if (MFA_EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return;
    if (pathname.startsWith('/dashboard/settings')) return;
    if (user.role === UserRole.AUDITOR) return;
    router.replace('/dashboard/settings?mfa=required');
  }, [user, loading, pathname, router]);

  return <>{children}</>;
}
