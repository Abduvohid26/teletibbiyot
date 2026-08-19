'use client';

import { ReactNode } from 'react';
import { isUtRole } from '@ishifo/shared';
import { UtShell } from '@/components/ut/UtShell';
import { useAuth } from '@/lib/auth-context';

export default function UtRootLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user && isUtRole(user.role)) {
    return <UtShell>{children}</UtShell>;
  }

  return children;
}
