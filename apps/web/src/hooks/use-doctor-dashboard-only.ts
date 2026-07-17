'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@ishifo/shared';

/** MT shifokor navbat/bemorlar oynasida qoladi */
export function useDoctorDashboardOnly() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === UserRole.MT_DOCTOR) {
      router.replace('/dashboard/patients');
    }
  }, [user, loading, router]);
}
