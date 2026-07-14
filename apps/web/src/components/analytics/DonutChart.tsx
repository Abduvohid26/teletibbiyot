'use client';

import { TRIAGE_COLORS, TRIAGE_LABELS } from '@/lib/analytics-types';

interface DonutChartProps {
  data: Array<{ level: string; count: number; percentage: number }>;
}

const COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  EMERGENCY: '#ef4444',
};

export function DonutChart({ data }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Ma&apos;lumot yo&apos;q</p>;
  }

  let cumulative = 0;
  const segments = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const start = cumulative;
      cumulative += (d.count / total) * 100;
      return { ...d, start, end: cumulative };
    });

  const gradient = segments
    .map((s) => `${COLORS[s.level] || '#94a3b8'} ${s.start}% ${s.end}%`)
    .join(', ');

  return (
    <div className="flex items-center gap-6">
      <div
        className="w-28 h-28 rounded-full shrink-0 relative"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900">{total}</p>
            <p className="text-[9px] text-slate-500 uppercase">Jami</p>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {data.map((d) => (
          <div key={d.level} className="flex items-center gap-2 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TRIAGE_COLORS[d.level] || 'bg-slate-400'}`} />
            <span className="text-slate-600 flex-1">{TRIAGE_LABELS[d.level] || d.level}</span>
            <span className="font-bold text-slate-800">{d.count}</span>
            <span className="text-slate-400 w-8 text-right">{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
