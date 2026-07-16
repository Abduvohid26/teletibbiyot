'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PlatformFooter } from './PlatformFooter';
import { SidebarProvider } from './sidebar-context';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { canAccessMtDashboard, isUtRole } from '@ishifo/shared';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

function DashboardLayoutInner({ children, title, subtitle, actions }: DashboardLayoutProps) {
  const { user } = useAuth();
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
