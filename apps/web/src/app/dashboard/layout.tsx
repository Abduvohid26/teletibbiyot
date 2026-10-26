'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isMtDoctor, isUtRole } from '@ishifo/shared';
import { DoctorShell } from '@/components/layout/DoctorShell';
import { UtShell } from '@/components/ut/UtShell';
import { useAuth } from '@/lib/auth-context';

/** Video workspace — scroll yo'q, qolgan sahifalar scrollable */
const LIVE_WORKSPACE = new Set(['/dashboard']);

export default function DashboardRootLayout({ children }: { children: ReactNode }) {
  const { user, hydrated } = useAuth();
  const pathname = usePathname();

  // Server user'ni bilmaydi (kesh sessionStorage'da) — shell faqat hydrate'dan keyin
  if (hydrated && user && isMtDoctor(user.role)) {
    return (
      <DoctorShell scrollable={!LIVE_WORKSPACE.has(pathname)}>
        {children}
      </DoctorShell>
    );
  }

  if (hydrated && user && isUtRole(user.role)) {
    return <UtShell scrollable>{children}</UtShell>;
  }

  return children;
}
