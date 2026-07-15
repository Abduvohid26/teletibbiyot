'use client';

import { Heart, Activity, Thermometer, Droplets, User, MapPin, Phone, CreditCard, Radio } from 'lucide-react';
import { Patient, ClinicalRecord } from '@/lib/api';
import { calculateAge, formatGender, cn } from '@/lib/utils';
import { useVitalsStream } from '@/hooks/use-vitals-stream';
import { VitalReading } from '@/lib/camera-vitals';

interface PatientInfoProps {
  patient?: Patient;
  clinicalRecord?: ClinicalRecord;
  consultationId?: string;
  compact?: boolean;
}

function LiveEkgWaveform({ waveform }: { waveform?: number[] }) {
  if (!waveform?.length) {
    return (
      <div className="w-full h-14 flex items-center justify-center text-[10px] text-slate-400 bg-slate-50 rounded-lg">
        EKG ma&apos;lumoti kutilmoqda
      </div>
    );
  }

  const pathD = waveform.map((y, i) => `${i === 0 ? 'M' : 'L'}${i * 3},${y}`).join(' ');

  return (
    <svg viewBox="0 0 300 60" className="w-full h-14">
      {[20, 40].map((y) => (
        <line key={y} x1="0" y1={y} x2="300" y2={y} className="ekg-grid" />
      ))}
      <path d={pathD} className="ekg-line" />
    </svg>
  );
}

function mergeVitals(staticVitals: Record<string, number>, live: VitalReading | null) {
  if (!live) return staticVitals;
  return {
    ...staticVitals,
    ...(live.heartRate != null ? { heartRate: live.heartRate } : {}),
    ...(live.bloodPressureSystolic != null ? { bloodPressureSystolic: live.bloodPressureSystolic } : {}),
    ...(live.bloodPressureDiastolic != null ? { bloodPressureDiastolic: live.bloodPressureDiastolic } : {}),
    ...(live.spo2 != null ? { spo2: live.spo2 } : {}),
    ...(live.temperature != null ? { temperature: live.temperature } : {}),
    ...(live.respiratoryRate != null ? { respiratoryRate: live.respiratoryRate } : {}),
  };
}

export function PatientInfo({ patient, clinicalRecord, consultationId, compact }: PatientInfoProps) {
  const staticVitals = clinicalRecord?.vitalSigns || {};
  const { connected, liveVitals } = useVitalsStream(consultationId, 'receive');
  const vitals = mergeVitals(staticVitals, liveVitals);
  const isLive = connected && !!liveVitals;

  if (!patient) {
    return (
      <div className="glass-panel h-full flex flex-col overflow-hidden min-h-0">
        <div className={cn('glass-header shrink-0', compact && 'py-1.5 px-2')}>
          <User size={compact ? 14 : 16} className="text-brand-600" />
          <span className={cn('panel-title', compact && 'text-xs')}>Bemor ma&apos;lumotlari</span>
        </div>
        <div className={cn('flex-1 overflow-hidden', compact ? 'p-2 space-y-2' : 'p-3 space-y-3')}>
          <div className="flex items-center gap-2">
            <div className={cn('rounded-xl bg-gradient-to-br from-brand-200/40 to-indigo-200/40 flex items-center justify-center shimmer-line', compact ? 'w-9 h-9' : 'w-11 h-11')}>
              <User className="w-4 h-4 text-brand-400/60" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="shimmer-line w-3/4 !h-3" />
              <div className="shimmer-line w-1/2 !h-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { icon: Heart, label: 'Yurak', unit: 'bpm', color: 'text-red-400' },
              { icon: Activity, label: 'Qon bosimi', unit: 'mmHg', color: 'text-blue-400' },
              { icon: Droplets, label: 'SpO2', unit: '%', color: 'text-cyan-400' },
              { icon: Thermometer, label: 'Harorat', unit: '°C', color: 'text-orange-400' },
            ].map((v) => (
              <div key={v.label} className="glass-vital !p-2 opacity-70">
                <div className="flex items-center gap-1 mb-1">
                  <v.icon size={10} className={v.color} />
                  <span className="text-[9px] text-slate-400">{v.label}</span>
                </div>
                <p className="text-sm font-bold text-slate-300">— <span className="text-[9px] font-normal">{v.unit}</span></p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 text-center pt-1">Konsultatsiyani boshlang — bemor ma&apos;lumotlari shu yerda ko&apos;rinadi</p>
        </div>
      </div>
    );
  }

  const age = calculateAge(patient.birthDate);
  const initials = patient.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('');

  return (
    <div className="panel h-full flex flex-col overflow-hidden min-h-0">
      <div className={cn('panel-header shrink-0', compact && 'py-1.5 px-2')}>
        <User size={compact ? 14 : 16} className="text-brand-600" />
        <span className={cn('panel-title', compact && 'text-xs')}>Bemor ma&apos;lumotlari</span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            <Radio size={10} />
            JONLI
          </span>
        )}
      </div>

      <div className={cn('panel-body flex-1 overflow-hidden', compact ? 'space-y-2 !p-2' : 'overflow-y-auto space-y-4')}>
        <div className={cn('flex items-start gap-3', compact && 'gap-2')}>
          <div className={cn('rounded-2xl bg-gradient-to-br from-brand-100 to-indigo-100 flex items-center justify-center text-brand-700 font-bold shrink-0', compact ? 'w-9 h-9 text-xs rounded-xl' : 'w-12 h-12 text-sm')}>
            {initials}
          </div>
          <div className="min-w-0">
            <h4 className={cn('font-bold text-slate-900 truncate', compact ? 'text-sm' : 'text-[15px]')}>{patient.fullName}</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {age} yosh · {formatGender(patient.gender)}
              {compact && patient.phone ? ` · ${patient.phone}` : ''}
            </p>
          </div>
        </div>

        {!compact && (
        <div className="space-y-2">
          {patient.passportNumber && (
            <InfoRow icon={CreditCard} label="Passport" value={patient.passportNumber} />
          )}
          <InfoRow icon={MapPin} label="Manzil" value={`${patient.region}, ${patient.district}`} />
          <InfoRow icon={Phone} label="Telefon" value={patient.phone} />
        </div>
        )}

        <div className={cn('border-t border-slate-100', compact ? 'pt-1' : 'pt-2')}>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1">
              <Activity size={12} className="text-emerald-500" />
              Vital
            </h3>
            <span className="text-[9px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {liveVitals?.timestamp
                ? new Date(liveVitals.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
                : new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {!compact && (
          <div className="rounded-xl bg-slate-900 p-3 mb-3 overflow-hidden">
            <p className="text-[10px] text-emerald-400/80 mb-1 font-medium uppercase tracking-wider">
              EKG · {liveVitals?.ekgWaveform?.length ? 'Jonli' : 'Kutilmoqda'}
            </p>
            <LiveEkgWaveform waveform={liveVitals?.ekgWaveform} />
          </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <VitalCard icon={Heart} label="Yurak urishi" value={vitals.heartRate ? `${vitals.heartRate}` : '—'} unit="bpm" accent="red" live={isLive && liveVitals?.heartRate != null} />
            <VitalCard
              icon={Activity}
              label="Qon bosimi"
              value={vitals.bloodPressureSystolic ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}` : '—'}
              unit="mmHg"
              accent="blue"
              live={isLive && liveVitals?.bloodPressureSystolic != null}
            />
            <VitalCard icon={Droplets} label="SpO2" value={vitals.spo2 ? `${vitals.spo2}` : '—'} unit="%" accent="cyan" live={isLive && liveVitals?.spo2 != null} />
            <VitalCard icon={Thermometer} label="Harorat" value={vitals.temperature ? `${vitals.temperature}` : '—'} unit="°C" accent="orange" live={isLive && liveVitals?.temperature != null} />
          </div>

          {vitals.respiratoryRate != null && !compact && (
            <p className="text-xs text-slate-500 mt-2 text-center">
              Nafas olish: <span className="font-semibold text-slate-700">{vitals.respiratoryRate}</span> /min
              {isLive && liveVitals?.respiratoryRate != null && (
                <span className="text-emerald-600 ml-1">· jonli</span>
              )}
            </p>
          )}

          {!isLive && consultationId && !compact && (
            <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2 mt-2 text-center">
              UT operator kamerani yoqmaguncha statik ma&apos;lumotlar ko&apos;rsatiladi
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <Icon size={14} className="text-slate-400 shrink-0" />
      <span className="text-slate-400 w-14 shrink-0">{label}</span>
      <span className="text-slate-700 font-medium truncate">{value}</span>
    </div>
  );
}

function VitalCard({
  icon: Icon,
  label,
  value,
  unit,
  accent,
  live,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit: string;
  accent: 'red' | 'blue' | 'cyan' | 'orange';
  live?: boolean;
}) {
  const accents = {
    red: 'from-red-50 border-red-100 text-red-600',
    blue: 'from-blue-50 border-blue-100 text-blue-600',
    cyan: 'from-cyan-50 border-cyan-100 text-cyan-600',
    orange: 'from-orange-50 border-orange-100 text-orange-600',
  };

  return (
    <div className={cn('vital-card bg-gradient-to-br border relative', accents[accent], live && 'ring-2 ring-emerald-400/50')}>
      {live && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
      )}
      <div className="flex items-center gap-1 mb-1.5">
        <Icon size={12} />
        <span className="text-[10px] font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-lg font-bold text-slate-900 leading-none">
        {value}
        {value !== '—' && <span className="text-[10px] font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}
