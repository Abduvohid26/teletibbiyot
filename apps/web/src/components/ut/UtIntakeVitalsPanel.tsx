'use client';

import { Monitor } from 'lucide-react';

const IN =
  'input !py-2 !px-3 !text-sm !min-h-[2.5rem] !bg-white/90 placeholder:text-slate-400 placeholder:font-normal';

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
    <div className="h-full flex flex-col gap-2 min-h-0">
      <div className="grid grid-cols-2 gap-2 shrink-0">
        <div>
          <label className="label !text-xs !mb-1" htmlFor="ut-vazn">
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
          <label className="label !text-xs !mb-1" htmlFor="ut-boy">
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

      <div className="flex-1 min-h-0 glass-preview-card !p-3 flex flex-col justify-center gap-2">
        <div className="flex items-center gap-2 text-violet-800">
          <div className="w-8 h-8 rounded-xl bg-violet-100/90 ring-1 ring-violet-200/70 flex items-center justify-center shrink-0">
            <Monitor size={15} />
          </div>
          <p className="text-sm font-semibold leading-tight">Patient monitor kamerasi</p>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Puls, qon bosimi, SpO2, harorat va nafas — <strong className="text-slate-800">jonli efirda</strong> monitor ekranidan olinadi.
        </p>
        <p className="text-[11px] text-slate-500 leading-snug">
          Qabulda faqat vazn va bo&apos;y kiritiladi.
        </p>
      </div>
    </div>
  );
}
