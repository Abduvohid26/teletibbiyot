'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski manager panel — admin statistikaga yo'naltirish */
export default function ManagerPageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin');
  }, [router]);
  return null;
}
