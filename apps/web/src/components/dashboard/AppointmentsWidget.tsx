'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Appointment } from '@/lib/api';
import { safeAsync } from '@/lib/errors';
import { Calendar, ChevronRight } from 'lucide-react';

export function AppointmentsWidget() {
  const [items, setItems] = useState<Appointment[]>([]);

  useEffect(() => {
    void safeAsync('upcoming-appointments', () => api.getUpcomingAppointments(3), []).then(setItems);
  }, []);

  if (!items.length) return null;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Calendar size={16} className="text-brand-600" />
          Yaqin uchrashuvlar
        </h3>
        <Link href="/dashboard/appointments" className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
          Barchasi <ChevronRight size={12} />
        </Link>
      </div>
      <ul className="space-y-2">
        {items.slice(0, 3).map((a) => (
          <li key={a.id} className="text-xs text-slate-600 flex justify-between gap-2">
            <span className="truncate font-medium text-slate-800">{a.patient.fullName}</span>
            <span className="shrink-0 text-slate-500">
              {new Date(a.scheduledAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
