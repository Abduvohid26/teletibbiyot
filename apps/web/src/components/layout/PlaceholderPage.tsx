'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <DashboardLayout title={title}>
      <div className="empty-state panel min-h-[400px]">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <span className="text-2xl">🚧</span>
        </div>
        <p className="text-slate-500 font-medium">Bu bo&apos;lim tez orada qo&apos;shiladi</p>
        <p className="text-sm text-slate-400 mt-1">Platforma rivojlantirish jarayonida</p>
      </div>
    </DashboardLayout>
  );
}
