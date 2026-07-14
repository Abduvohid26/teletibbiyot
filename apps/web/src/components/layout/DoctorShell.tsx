'use client';

import { ReactNode } from 'react';
import { DoctorHeader } from './DoctorHeader';
import { DashboardStats } from '@/lib/api';

interface DoctorShellProps {
  children: ReactNode;
  scrollable?: boolean;
  stats?: DashboardStats | null;
  queueCount?: number;
  showComplete?: boolean;
  onComplete?: () => void;
  onStartNext?: () => void;
  nextPatientName?: string;
  onSecondOpinion?: () => void;
  onAttachments?: () => void;
  attachmentCount?: number;
  notificationCount?: number;
}

export function DoctorShell({
  children,
  scrollable = false,
  stats,
  queueCount,
  showComplete,
  onComplete,
  onStartNext,
  nextPatientName,
  onSecondOpinion,
  onAttachments,
  attachmentCount,
  notificationCount,
}: DoctorShellProps) {
  return (
    <div className="doctor-shell">
      <div className="liquid-bg" aria-hidden>
        <div className="liquid-orb liquid-orb-1" />
        <div className="liquid-orb liquid-orb-2" />
        <div className="liquid-orb liquid-orb-3" />
      </div>
      <DoctorHeader
        stats={stats}
        queueCount={queueCount}
        showComplete={showComplete}
        onComplete={onComplete}
        onStartNext={onStartNext}
        nextPatientName={nextPatientName}
        onSecondOpinion={onSecondOpinion}
        onAttachments={onAttachments}
        attachmentCount={attachmentCount}
        notificationCount={notificationCount}
      />
      <main className={scrollable ? 'doctor-subpage relative z-10' : 'doctor-body relative z-10'}>{children}</main>
    </div>
  );
}
