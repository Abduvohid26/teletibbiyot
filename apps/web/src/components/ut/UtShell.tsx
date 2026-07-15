'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Stethoscope, Users, Radio, LogOut, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface UtShellProps {
  children: React.ReactNode;
  sessionCount?: number;
  liveCount?: number;
  headerExtra?: React.ReactNode;
}

const NAV = [
  { href: '/ut', label: 'Qabul', icon: Stethoscope, exact: true },
  { href: '/ut/patients', label: 'Bemorlar', icon: Users },
  { href: '/ut/vitals', label: 'Jonli efir', icon: Radio },
] as const;

export function UtShell({ children, sessionCount = 0, liveCount = 0, headerExtra }: UtShellProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-dvh h-dvh flex flex-col bg-surface overflow-hidden">
      <header className="shrink-0 z-30 bg-white border-b border-slate-200/90 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 py-2">
          <div className="flex items-center gap-2 justify-between mb-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">UT operator</p>
              <p className="text-sm font-bold text-slate-900 truncate">{user?.facility?.name}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {sessionCount > 0 && (
                <span className="hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {liveCount > 0 && <span className="text-emerald-600">{liveCount} jonli</span>}
                  {liveCount > 0 && sessionCount > liveCount && ' · '}
                  {sessionCount > liveCount && <span className="text-amber-700">{sessionCount - liveCount} navbat</span>}
                  {liveCount === 0 && `${sessionCount} bemor`}
                </span>
              )}
              <Link href="/ut" className="btn-secondary !py-1 !px-2 !text-[11px] inline-flex items-center gap-1">
                <UserPlus size={12} /> Yangi
              </Link>
              <button type="button" onClick={logout} className="btn-ghost !p-1.5 text-red-500" aria-label="Chiqish">
                <LogOut size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <nav className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100/80">
              {NAV.map(({ href, label, icon: Icon, ...rest }) => {
                const exact = 'exact' in rest && rest.exact;
                const active = exact ? pathname === href : pathname.startsWith(href);
                const badge = href === '/ut/patients' && sessionCount > 0 ? sessionCount : null;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      active
                        ? 'bg-white text-brand-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800',
                    )}
                  >
                    <Icon size={14} />
                    {label}
                    {badge != null && (
                      <span className={cn(
                        'min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                        active ? 'bg-brand-600 text-white' : 'bg-slate-300 text-slate-700',
                      )}>
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            {headerExtra && <div className="flex-1 min-w-0 flex justify-end">{headerExtra}</div>}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
