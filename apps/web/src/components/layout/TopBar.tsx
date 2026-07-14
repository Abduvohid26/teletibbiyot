'use client';

import { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { SmartSearch } from '@/components/analytics/SmartSearch';
import { useSidebar } from '@/components/layout/sidebar-context';
import { ClientDateText } from '@/components/ui/ClientDateText';

interface TopBarProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  showMenu?: boolean;
}

export function TopBar({ title, subtitle, actions, showMenu = true }: TopBarProps) {
  const { toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {showMenu && (
            <button
              type="button"
              className="lg:hidden btn-ghost !p-2 shrink-0"
              aria-label="Menyuni ochish"
              onClick={toggle}
            >
              <Menu size={20} />
            </button>
          )}
          <div className="min-w-0">
            {title ? (
              <>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight truncate">{title}</h1>
                {subtitle && <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>}
              </>
            ) : (
              <>
                <ClientDateText
                  className="text-xs font-medium text-slate-400 uppercase tracking-wide hidden sm:block"
                  format={{ weekday: 'long', day: 'numeric', month: 'long' }}
                />
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Shifokor paneli</h1>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {actions}
          <SmartSearch className="hidden md:block w-44 lg:w-64 xl:w-72" />
        </div>
      </div>
    </header>
  );
}
