'use client';

import { Monitor } from 'lucide-react';

const IN =
  'form-input !py-1 !px-2 !text-[14px] !min-h-[2.275rem] leading-snug placeholder:text-slate-400 placeholder:font-normal';

interface UtIntakeVitalsPanelProps {
  weight: string;
  height: string;
  onWeightChange: (value: string) => void;
  onHeightChange: (value: string) => void;
}

export function UtIntakeVitalsPanel({
  weight,
  height,
  onWeightChange,
  onHeightChange,
}: UtIntakeVitalsPanelProps) {
  return (
    <div className="h-full flex flex-col gap-1.5 min-h-0">
      <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 shrink-0">
        <div>
          <label className="label !text-[13px] !mb-0.5 !leading-snug" htmlFor="ut-vazn">
            Vazn (kg) <span className="text-red-500">*</span>
          </label>
          <input
            id="ut-vazn"
            type="number"
            className={IN}
            value={weight}
            onChange={(e) => onWeightChange(e.target.value)}
            placeholder="70"
          />
        </div>
        <div>
          <label className="label !text-[13px] !mb-0.5 !leading-snug" htmlFor="ut-boy">
            Bo&apos;y (sm) <span className="text-red-500">*</span>
          </label>
          <input
            id="ut-boy"
            type="number"
            className={IN}
            value={height}
            onChange={(e) => onHeightChange(e.target.value)}
            placeholder="170"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-lg border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white p-2 flex flex-col justify-center gap-1.5">
        <div className="flex items-center gap-1.5 text-violet-800">
          <Monitor size={15} className="shrink-0" />
          <p className="text-[12px] font-bold leading-tight">Patient monitor kamerasi</p>
        </div>
        <p className="text-[11px] text-violet-900/80 leading-snug">
          Puls, qon bosimi, SpO2, harorat va nafas — <strong>jonli efirda</strong> monitor ekraniga qaratilgan kameradan olinadi.
        </p>
        <p className="text-[10px] text-slate-500 leading-snug">
          Qabulda faqat vazn va bo&apos;y kiritiladi. Boshqa vital ko&apos;rsatkichlarni bu yerda kiritish shart emas.
        </p>
      </div>
    </div>
  );
}
