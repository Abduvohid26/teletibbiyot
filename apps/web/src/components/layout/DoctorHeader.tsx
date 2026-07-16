'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Stethoscope, BarChart3, Settings, LogOut, Play, Activity, Clock, Users,
  CheckCircle2, MessageSquarePlus, Paperclip, Bell, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { SmartSearch } from '@/components/analytics/SmartSearch';
import { BrandName } from '@/components/brand/BrandName';
import { DashboardStats, Consultation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ConsultationSwitcher } from '@/components/dashboard/ConsultationSwitcher';

interface DoctorHeaderProps {
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
  activeConsultationId?: string | null;
  myInProgress?: Consultation[];
  queuedConsultations?: Consultation[];
  onSelectConsultation?: (id: string) => void;
  onReconnectConsultation?: (id: string) => void;
  onStartConsultation?: (id: string) => void;
}

export function DoctorHeader({
  stats,
  queueCount = 0,
  showComplete,
  onComplete,
  onStartNext,
  nextPatientName,
  onSecondOpinion,
  onAttachments,
  attachmentCount = 0,
  notificationCount = 0,
  activeConsultationId,
  myInProgress = [],
  queuedConsultations = [],
  onSelectConsultation,
  onReconnectConsultation,
  onStartConsultation,
}: DoctorHeaderProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isMain = pathname === '/dashboard';

  return (
    <header className="shrink-0 min-h-12 glass-panel !rounded-none border-x-0 border-t-0 px-2 lg:px-3 flex items-center gap-1.5 lg:gap-2 z-30 flex-wrap py-1.5">
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 via-indigo-600 to-accent-600 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
          <Stethoscope className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="hidden sm:block">
          <p className="text-sm leading-none"><BrandName size="sm" className="text-slate-900" /></p>          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Shifokor</p>
        </div>
      </Link>

      {stats && isMain && (
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <StatChip icon={Activity} value={stats.inProgress} label="Jarayon" tone="emerald" />
          <StatChip icon={Clock} value={stats.queued} label="Navbat" tone="amber" />
          <StatChip icon={Users} value={stats.totalPatients} label="Bemor" tone="brand" />
          <StatChip icon={CheckCircle2} value={stats.completed} label="Yakun" tone="violet" />
        </div>
      )}

      {isMain && (myInProgress.length > 0 || queuedConsultations.length > 0) && onSelectConsultation && onStartConsultation && (
        <ConsultationSwitcher
          variant="header"
          activeId={activeConsultationId ?? undefined}
          myInProgress={myInProgress}
          queued={queuedConsultations}
          onSelect={onSelectConsultation}
          onReconnect={onReconnectConsultation}
          onStart={onStartConsultation}
        />
      )}

      <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5 lg:gap-2">
        {isMain && queueCount > 0 && onStartNext && (
          <button type="button" onClick={onStartNext} className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shrink-0">
            <Play size={12} />
            Boshlash{nextPatientName ? ` — ${nextPatientName.split(' ')[0]}` : ''}
          </button>
        )}

        <SmartSearch className="hidden xl:block w-40 2xl:w-52 !text-xs" />

        <nav className="flex items-center gap-0.5 shrink-0">
          <HeaderNavLink href="/dashboard" icon={LayoutDashboard} label="Asosiy" active={pathname === '/dashboard'} />
          <HeaderNavLink href="/dashboard/reports" icon={BarChart3} label="Analitika" active={pathname === '/dashboard/reports'} />
          <HeaderNavLink href="/dashboard/settings" icon={Settings} label="Sozlamalar" active={pathname === '/dashboard/settings'} />
        </nav>

        {isMain && (
          <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1.5 ml-0.5">
            <IconBtn icon={Bell} label="Xabarlar" badge={notificationCount} href="/dashboard/messages" />
            <IconBtn icon={Paperclip} label="Fayllar" badge={attachmentCount} onClick={onAttachments} />
            <IconBtn icon={MessageSquarePlus} label="Ikkinchi fikr" onClick={onSecondOpinion} />
          </div>
        )}

        {isMain && showComplete && onComplete && (
          <button type="button" onClick={onComplete} className="gradient-btn !py-1.5 !px-3 !text-xs shrink-0">
            <Stethoscope size={13} />
            <span className="hidden sm:inline">Yakuniy tashxis</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center text-white text-xs font-bold">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <button type="button" onClick={logout} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 min-h-[var(--touch-min)] min-w-[var(--touch-min)] flex items-center justify-center" aria-label="Chiqish">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

function StatChip({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  tone: 'emerald' | 'amber' | 'brand' | 'violet';
}) {
  const tones = {
    emerald: 'text-emerald-700 bg-emerald-50',
    amber: 'text-amber-700 bg-amber-50',
    brand: 'text-brand-700 bg-brand-50',
    violet: 'text-violet-700 bg-violet-50',
  };
  return (
    <div className={cn('glass-chip', tones[tone])}>
      <Icon size={11} />
      <span className="font-bold">{value}</span>
      <span className="opacity-70 hidden lg:inline">{label}</span>
    </div>
  );
}

function HeaderNavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[var(--touch-min)]',
        active ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
      )}
      title={label}
    >
      <Icon size={14} />
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}

function IconBtn({
  icon: Icon,
  label,
  badge,
  onClick,
  href,
}: {
  icon: React.ElementType;
  label: string;
  badge?: number;
  onClick?: () => void;
  href?: string;
}) {
  const className = 'relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 min-h-[var(--touch-min)] min-w-[var(--touch-min)] flex items-center justify-center';
  const content = (
    <>
      <Icon size={15} aria-hidden />
      {badge != null && badge > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      {content}
    </button>
  );
}
