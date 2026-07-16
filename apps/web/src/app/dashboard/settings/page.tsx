'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DoctorShell } from '@/components/layout/DoctorShell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { SettingsContent } from '@/components/settings/SettingsContent';
import { UserRole, isUtRole, isMtStaff } from '@ishifo/shared';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500 animate-pulse">Sozlamalar yuklanmoqda...</div>}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();

  const isUt = isUtRole(user?.role || '');
  const videoRole = isUt ? 'ut' : 'mt';

  useEffect(() => {
    if (authLoading || !user || !isUt) return;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    router.replace(`/ut/settings${hash}`);
  }, [authLoading, user, isUt, router]);

  if (authLoading || !user) return null;
  if (isUt) return null;

  const pageBody = <SettingsContent user={user} videoRole={videoRole} />;

  if (isMtStaff(user.role)) {
    return (
      <DoctorShell scrollable>
        {pageBody}
      </DoctorShell>
    );
  }

  return pageBody;
}
