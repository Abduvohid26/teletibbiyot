'use client';

import Link from 'next/link';
import { BrandName } from '@/components/brand/BrandName';
import { BRAND, UserRole } from '@ishifo/shared';
import { usePathname } from 'next/navigation';
import {
  Home, Video, Users, Brain, Monitor, BarChart3, Settings, LogOut, Stethoscope,
  AlertTriangle, Bell, Calendar, Film, Shield, X, Scan,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/layout/sidebar-context';
import { canAccessRoute, getRoleLabel } from '@/lib/auth-utils';

const menuItems = [
  { href: '/dashboard', icon: Home, label: 'Bosh sahifa', exact: true },
  { href: '/dashboard/consultations', icon: Video, label: 'Konsultatsiyalar' },
  { href: '/dashboard/triage', icon: AlertTriangle, label: 'Triage navbat' },
  { href: '/dashboard/patients', icon: Users, label: 'Bemorlar' },
  { href: '/dashboard/ai', icon: Brain, label: 'AI Tahlil' },
  { href: '/dashboard/manager', icon: BarChart3, label: 'SLA / KPI' },
  { href: '/dashboard/messages', icon: Bell, label: 'Xabarlar' },
  { href: '/dashboard/appointments', icon: Calendar, label: 'Uchrashuvlar' },
  { href: '/dashboard/recordings', icon: Film, label: 'Video yozuvlar' },
  { href: '/dashboard/devices', icon: Monitor, label: 'Qurilmalar' },
  { href: '/dashboard/reports', icon: BarChart3, label: 'Hisobotlar' },
  { href: '/dashboard/dicom', icon: Scan, label: 'DICOM ko\'rish' },
  { href: '/dashboard/incidents', icon: AlertTriangle, label: 'Incident' },
  { href: '/admin', icon: Shield, label: 'Boshqaruv' },
  { href: '/admin/audit', icon: Shield, label: 'Audit jurnali' },
  { href: '/dashboard/settings', icon: Settings, label: 'Sozlamalar' },
];

const utMenuItems = [
  { href: '/ut', icon: Stethoscope, label: 'Bemor qabul', exact: true },
  { href: '/dashboard/appointments', icon: Calendar, label: 'Uchrashuvlar' },
  { href: '/dashboard/devices', icon: Monitor, label: 'Qurilmalar' },
  { href: '/dashboard/dicom', icon: Scan, label: 'DICOM' },
  { href: '/dashboard/messages', icon: Bell, label: 'Xabarlar' },
  { href: '/dashboard/reports', icon: BarChart3, label: 'Analitika' },
  { href: '/dashboard/incidents', icon: AlertTriangle, label: 'Incident' },
  { href: '/dashboard/settings', icon: Settings, label: 'Sozlamalar' },
];

interface SidebarProps {
  visible?: boolean;
}

export function Sidebar({ visible = true }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { open, setOpen } = useSidebar();

  if (!visible || !user) return null;

  const isUt = user.role === UserRole.UT_OPERATOR;
  const isAuditor = user.role === UserRole.AUDITOR;
  const items = isUt
    ? utMenuItems
    : isAuditor
      ? menuItems.filter((item) => item.href.startsWith('/admin/audit'))
      : menuItems.filter((item) => canAccessRoute(user.role, item.href));

  const close = () => setOpen(false);

  return (
    <>
      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Menyuni yopish"
          onClick={close}
        />
      )}

      <aside
        className={cn(
          'sidebar-drawer bg-white/95 backdrop-blur-md border-r border-slate-200/80',
          open && 'sidebar-drawer-open',
        )}
        aria-label="Asosiy navigatsiya"
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <Link
            href={isUt ? '/ut' : isAuditor ? '/admin/audit' : '/dashboard'}
            className="flex items-center gap-3 group min-w-0"
            onClick={close}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 via-indigo-600 to-accent-600 flex items-center justify-center shadow-sm group-hover:scale-[1.02] transition-transform">
              <Stethoscope className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm leading-tight truncate">
                <BrandName size="sm" className="text-slate-900" />
              </h1>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">
                {BRAND.supporterShort}
              </p>
            </div>
          </Link>
          <button
            type="button"
            className="lg:hidden btn-ghost !p-2 shrink-0"
            aria-label="Menyuni yopish"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Asosiy</p>
          {items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[var(--touch-min)]',
                  active
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <item.icon size={18} className={cn(active ? 'text-brand-600' : 'text-slate-400')} strokeWidth={active ? 2.5 : 2} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3 mb-3 p-2 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.fullName}</p>
              <p className="text-xs text-slate-500">{getRoleLabel(user?.role || '')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors min-h-[var(--touch-min)]"
          >
            <LogOut size={16} />
            Chiqish
          </button>
        </div>
      </aside>
    </>
  );
}
