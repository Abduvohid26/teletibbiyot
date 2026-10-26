'use client';

import { ReactNode } from 'react';
import { isUtRole } from '@ishifo/shared';
import { UtShell } from '@/components/ut/UtShell';
import { useAuth } from '@/lib/auth-context';

export default function UtRootLayout({ children }: { children: ReactNode }) {
  const { user, hydrated } = useAuth();

  // Server user'ni bilmaydi (kesh sessionStorage'da) — birinchi client render
  // server bilan bir xil bo'lishi uchun shell faqat hydrate'dan keyin chiziladi.
  if (hydrated && user && isUtRole(user.role)) {
    return <UtShell>{children}</UtShell>;
  }

  return children;
}
