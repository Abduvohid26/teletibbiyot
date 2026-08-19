'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { UtHeader } from '@/components/ut/UtHeader';
import { UtPatientSwitcher } from '@/components/ut/UtPatientSwitcher';
import { useUtHeaderData } from '@/hooks/use-ut-header-data';

interface UtShellProps {
  children: ReactNode;
  scrollable?: boolean;
}

/**
 * UT operator uchun yagona shell.
 * Header layout orqali saqlanadi: brend | nav | til + bemor + yangi bemor | chiqish.
 */
export function UtShell({ children, scrollable = false }: UtShellProps) {
  const { user, logout } = useAuth();
  const header = useUtHeaderData();

  return (
    <div className="ut-shell">
      <div className="ut-shell-bg" aria-hidden>
        <div className="liquid-orb liquid-orb-1 opacity-50 scale-75" />
        <div className="liquid-orb liquid-orb-2 opacity-40 scale-90" />
      </div>

      <UtHeader
        facilityName={user?.facility?.name}
        sessionCount={header.sessionCount}
        liveCount={header.liveCount}
        headerQueue={
          header.hasQueue ? (
            <UtPatientSwitcher
              activeId={header.activeId}
              sessions={header.sessions}
              onSelect={header.onSelect}
              onCancel={header.onCancel}
            />
          ) : undefined
        }
        onLogout={logout}
      />

      <main className={scrollable ? 'ut-subpage relative z-10' : 'ut-shell-main relative z-10'}>
        {children}
      </main>

      {header.cancelModal}
    </div>
  );
}

/** Sahifa sarlavhasi — content ichida (dinamik holatlar uchun) */
export function UtPageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ut-page-head shrink-0 animate-fade-in">
      <div className="min-w-0 flex items-baseline gap-2">
        <h1 className="text-sm font-bold text-slate-900 tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 truncate hidden sm:block">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
