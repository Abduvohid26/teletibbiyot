'use client';

import { ReactNode } from 'react';
import { DoctorHeader } from './DoctorHeader';
import { ConsultationSwitcher } from '@/components/dashboard/ConsultationSwitcher';
import { useDoctorHeaderData } from '@/hooks/use-doctor-header-data';

interface DoctorShellProps {
  children: ReactNode;
  scrollable?: boolean;
}

/**
 * Shifokor dashboard uchun yagona shell.
 * Header layout orqali saqlanadi: brand | nav | til + bemor | chiqish.
 */
export function DoctorShell({ children, scrollable = false }: DoctorShellProps) {
  const header = useDoctorHeaderData();

  return (
    <div className="ut-shell">
      <div className="ut-shell-bg" aria-hidden>
        <div className="liquid-orb liquid-orb-1 opacity-50 scale-75" />
        <div className="liquid-orb liquid-orb-2 opacity-40 scale-90" />
      </div>

      <DoctorHeader
        liveCount={header.liveCount}
        queueCount={header.queueCount}
        headerQueue={
          header.hasQueue ? (
            <ConsultationSwitcher
              activeId={header.activeId}
              myInProgress={header.myInProgress}
              queued={header.queued}
              onSelect={header.onSelect}
              onStart={(id) => void header.onStart(id)}
              onReconnect={header.onReconnect}
              onCancel={header.onCancel}
            />
          ) : undefined
        }
      />

      <main className={scrollable ? 'doctor-subpage relative z-10' : 'ut-shell-main relative z-10'}>
        {children}
      </main>

      {header.cancelModal}
    </div>
  );
}
