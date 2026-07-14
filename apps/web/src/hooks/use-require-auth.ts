'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function useRequireAuth(allowedRoles?: readonly string[]) {
  const { user, loading, authError, retryAuth } = useAuth();
  const router = useRouter();
  const rolesKey = allowedRoles?.join('|') ?? '';
  const roles = useMemo(
    () => (allowedRoles ? [...allowedRoles] : undefined),
    [rolesKey],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace('/unauthorized');
    }
  }, [user, loading, router, roles]);

  return { user, loading, authError, retryAuth };
}
