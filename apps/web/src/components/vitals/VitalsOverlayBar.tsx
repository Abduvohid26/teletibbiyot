'use client';

import { Heart, Activity, Thermometer, Droplets } from 'lucide-react';
import { VitalReading } from '@/lib/camera-vitals';
import { cn } from '@/lib/utils';

type VitalsOverlayBarProps = {
  reading: VitalReading;
  onChange?: (reading: VitalReading) => void;
  editable?: boolean;
  variant?: 'ut' | 'doctor';
  className?: string;
};

export function VitalsOverlayBar({
  reading,
  onChange,
  editable = false,
  variant = 'ut',
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

  if (variant === 'doctor') {
    const bp =
      reading.bloodPressureSystolic != null && reading.bloodPressureDiastolic != null
        ? `${reading.bloodPressureSystolic}/${reading.bloodPressureDiastolic}`
        : reading.bloodPressureSystolic != null
          ? `${reading.bloodPressureSystolic}`
          : undefined;

    return (
      <div
        className={cn(
          'grid grid-cols-4 gap-1 rounded-xl bg-gradient-to-br from-slate-900/95 to-slate-800/95 text-white ring-1 ring-white/10 backdrop-blur-sm p-2',
          className,
        )}
      >
        <DoctorVitalCell icon={Heart} label="Puls" value={reading.heartRate} unit="bpm" color="text-red-400" />
        <DoctorVitalCell icon={Activity} label="Qon bosimi" value={bp} unit="mmHg" color="text-blue-400" />
        <DoctorVitalCell icon={Droplets} label="SpO2" value={reading.spo2} unit="%" color="text-cyan-400" />
        <DoctorVitalCell icon={Thermometer} label="Harorat" value={reading.temperature} unit="°C" color="text-orange-400" />
      </div>
    );
  }

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

function DoctorVitalCell({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value?: number | string;
  unit: string;
  color: string;
}) {
  return (
    <div className="text-center py-0.5 min-w-0">
      <Icon size={13} className={cn('mx-auto mb-0.5', color)} />
      <p className="text-[9px] text-slate-400 uppercase tracking-wide truncate">{label}</p>
      <p className="text-lg font-bold leading-tight">
        {value ?? '—'}
        {value != null && value !== '—' && (
          <span className="text-[9px] font-normal text-slate-400 ml-0.5">{unit}</span>
        )}
      </p>
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

export function mergeVitalsReading(
  staticVitals: Record<string, number>,
  live: VitalReading | null,
): VitalReading {
  const base = vitalsFromRecord(staticVitals);
  if (!live) return base;
  return {
    ...base,
    ...(live.heartRate != null ? { heartRate: live.heartRate } : {}),
    ...(live.bloodPressureSystolic != null ? { bloodPressureSystolic: live.bloodPressureSystolic } : {}),
    ...(live.bloodPressureDiastolic != null ? { bloodPressureDiastolic: live.bloodPressureDiastolic } : {}),
    ...(live.spo2 != null ? { spo2: live.spo2 } : {}),
    ...(live.temperature != null ? { temperature: live.temperature } : {}),
    ...(live.respiratoryRate != null ? { respiratoryRate: live.respiratoryRate } : {}),
  };
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
