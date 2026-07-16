'use client';

import { Heart, Activity } from 'lucide-react';
import { VitalReading } from '@/lib/camera-vitals';
import { cn } from '@/lib/utils';

type VitalsOverlayBarProps = {
  reading: VitalReading;
  onChange?: (reading: VitalReading) => void;
  editable?: boolean;
  className?: string;
};

export function VitalsOverlayBar({
  reading,
  onChange,
  editable = false,
  className,
}: VitalsOverlayBarProps) {
  const update = (key: keyof VitalReading, raw: string) => {
    if (!onChange) return;
    const num = raw.trim() === '' ? undefined : Number(raw);
    onChange({
      ...reading,
      [key]: Number.isFinite(num as number) ? num : undefined,
      source: 'device',
    });
  };

  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-1 rounded-xl bg-gradient-to-br from-slate-900/95 to-slate-800/95 text-white ring-1 ring-white/10 backdrop-blur-sm p-2',
        className,
      )}
    >
      <VitalCell
        icon={Heart}
        label="Puls"
        value={reading.heartRate}
        unit="bpm"
        color="text-red-400"
        editable={editable}
        onChange={(v) => update('heartRate', v)}
      />
      <VitalCell
        icon={Activity}
        label="Nafas"
        value={reading.respiratoryRate}
        unit="/min"
        color="text-cyan-400"
        editable={editable}
        onChange={(v) => update('respiratoryRate', v)}
      />
      <VitalCell
        icon={Activity}
        label="SpO2"
        value={reading.spo2}
        unit="%"
        color="text-sky-400"
        editable={editable}
        onChange={(v) => update('spo2', v)}
      />
    </div>
  );
}

function VitalCell({
  icon: Icon,
  label,
  value,
  unit,
  color,
  editable,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  value?: number;
  unit: string;
  color: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="text-center py-0.5 min-w-0">
      <Icon size={14} className={cn('mx-auto mb-0.5', color)} />
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      {editable ? (
        <input
          type="number"
          className="w-full bg-transparent text-center text-xl font-bold text-white outline-none border-b border-white/20 focus:border-brand-400 mt-0.5"
          value={value ?? ''}
          placeholder="—"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <p className="text-xl font-bold leading-tight">
          {value ?? '—'}
          {value != null && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{unit}</span>}
        </p>
      )}
      {editable && value != null && (
        <span className="text-[10px] text-slate-400">{unit}</span>
      )}
    </div>
  );
}

export function vitalsFromRecord(record?: Record<string, number>): VitalReading {
  return {
    heartRate: record?.heartRate,
    spo2: record?.spo2,
    bloodPressureSystolic: record?.bloodPressureSystolic,
    bloodPressureDiastolic: record?.bloodPressureDiastolic,
    temperature: record?.temperature,
    respiratoryRate: record?.respiratoryRate,
  };
}
