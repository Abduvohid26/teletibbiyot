'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PlatformFooter } from './PlatformFooter';
import { SidebarProvider } from './sidebar-context';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { canAccessMtDashboard, isMtDoctor, isUtRole } from '@ishifo/shared';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

function DashboardLayoutInner({ children, title, subtitle, actions }: DashboardLayoutProps) {
  const { user } = useAuth();

  if (user && (isMtDoctor(user.role) || isUtRole(user.role))) {
    return (
      <div className="space-y-4 pb-6">
        {(title || subtitle || actions) && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <h1 className="text-lg font-bold text-slate-900 tracking-tight truncate">{title}</h1>
              )}
              {subtitle && (
                <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        )}
        {children}
      </div>
    );
  }

  const showSidebar = !!user && (canAccessMtDashboard(user.role) || isUtRole(user.role));

  return (
    <div className="page-shell">
      <Sidebar visible={showSidebar} />
      <div className={cn('page-main', !showSidebar && 'page-main-no-sidebar')}>
        <TopBar title={title} subtitle={subtitle} actions={actions} showMenu={showSidebar} />
        <div className="page-content flex flex-col min-h-0">
          <div className="flex-1">{children}</div>
          <div className="mt-8 pt-6 border-t border-slate-200/80 px-1 pb-2">
            <PlatformFooter variant="compact" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardLayoutInner {...props} />
    </SidebarProvider>
  );
}
