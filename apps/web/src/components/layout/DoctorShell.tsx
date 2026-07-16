'use client';

import { ReactNode } from 'react';
import { DoctorHeader } from './DoctorHeader';

interface DoctorShellProps {
  children: ReactNode;
  scrollable?: boolean;
  liveCount?: number;
  queueCount?: number;
  headerQueue?: React.ReactNode;
  pageAction?: React.ReactNode;
}

export function DoctorShell({
  children,
  scrollable = false,
  liveCount = 0,
  queueCount = 0,
  headerQueue,
  pageAction,
}: DoctorShellProps) {
  return (
    <div className="ut-shell">
      <div className="ut-shell-bg" aria-hidden>
        <div className="liquid-orb liquid-orb-1 opacity-50 scale-75" />
        <div className="liquid-orb liquid-orb-2 opacity-40 scale-90" />
      </div>

      <DoctorHeader
        liveCount={liveCount}
        queueCount={queueCount}
        headerQueue={headerQueue}
        pageAction={pageAction}
      />

      <main className={scrollable ? 'doctor-subpage relative z-10' : 'ut-shell-main relative z-10'}>
        {children}
      </main>
    </div>
  );
}
