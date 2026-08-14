'use client';

import { useI18n } from '@/i18n';

interface TrendChartProps {
  data: Array<{ date: string; total: number; completed: number }>;
}

export function TrendChart({ data }: TrendChartProps) {
  const { t } = useI18n();

  if (data.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">{t('chart.noData')}</p>;
  }

  const max = Math.max(...data.map((d) => d.total), 1);
  const width = 100;
  const height = 48;
  const step = width / Math.max(data.length - 1, 1);

  const totalPoints = data.map((d, i) => `${i * step},${height - (d.total / max) * height}`).join(' ');
  const completedPoints = data.map((d, i) => `${i * step},${height - (d.completed / max) * height}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
        <polyline fill="none" stroke="#e2e8f0" strokeWidth="0.5" points={`0,${height} ${width},${height}`} />
        <polyline fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeLinejoin="round" points={totalPoints} />
        <polyline fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" points={completedPoints} />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
      <div className="flex gap-4 mt-2 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-300" /> {t('chart.total')}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-brand-600" /> {t('chart.completed')}</span>
      </div>
    </div>
  );
}
