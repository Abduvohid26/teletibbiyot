'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Stethoscope, LogOut } from 'lucide-react';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import { useAuth } from '@/lib/auth-context';

interface SimplePageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const widthClass = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-6xl',
};

export function SimplePageLayout({
  title,
  subtitle,
  children,
  backHref,
  backLabel,
  maxWidth = '2xl',
}: SimplePageLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={backHref || '/'} className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 flex items-center justify-center shadow-sm">
                <Stethoscope className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <BrandName size="sm" className="text-slate-900 hidden sm:inline" />
            </Link>
            <div className="min-w-0 border-l border-slate-200 pl-3">
              <h1 className="text-base font-bold text-slate-900 truncate">{title}</h1>
              {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {backHref && backLabel && (
              <Link href={backHref} className="btn-secondary !py-2 !px-3 !text-xs hidden sm:inline-flex">
                {backLabel}
              </Link>
            )}
            {user && (
              <span className="text-xs text-slate-500 hidden md:inline truncate max-w-[140px]">
                {user.fullName}
              </span>
            )}
            <button
              type="button"
              onClick={logout}
              className="btn-ghost !p-2"
              aria-label="Chiqish"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 py-6 ${widthClass[maxWidth]}`}>
        {children}
      </main>
      <footer className="px-6 py-4 border-t border-slate-200/80 bg-white/60">
        <PlatformFooter variant="compact" />
      </footer>
    </div>
  );
}
