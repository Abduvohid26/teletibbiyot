'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isMtDoctor } from '@ishifo/shared';
import { DoctorShell } from '@/components/layout/DoctorShell';
import { useAuth } from '@/lib/auth-context';

/** Video workspace — scroll yo'q, qolgan sahifalar scrollable */
const LIVE_WORKSPACE = new Set(['/dashboard']);

export default function DashboardRootLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (user && isMtDoctor(user.role)) {
    return (
      <DoctorShell scrollable={!LIVE_WORKSPACE.has(pathname)}>
        {children}
      </DoctorShell>
    );
  }

  return children;
}
