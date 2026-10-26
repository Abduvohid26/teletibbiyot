'use client';

import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

const IN =
  'input ut-glass-input !py-2 !px-3 !text-sm !min-h-[2.5rem] placeholder:text-slate-400 placeholder:font-normal';

interface UtIntakeVitalsPanelProps {
  weight: string;
  height: string;
  onWeightChange: (value: string) => void;
  onHeightChange: (value: string) => void;
}

/** JSST tasnifi bo'yicha TVI (kg/m²) */
function bmiOf(weight: string, height: string) {
  const w = Number(weight);
  const h = Number(height) / 100;
  if (!w || !h || w < 1 || h < 0.3) return null;
  const value = w / (h * h);
  if (!Number.isFinite(value) || value > 100) return null;
  const level =
    value < 18.5 ? 'under' : value < 25 ? 'normal' : value < 30 ? 'over' : 'obese';
  return { value, level } as const;
}

const LEVEL_STYLE = {
  under: { key: 'vitals.bmiUnder', text: 'text-sky-700', bar: 'bg-sky-500' },
  normal: { key: 'vitals.bmiNormal', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  over: { key: 'vitals.bmiOver', text: 'text-amber-700', bar: 'bg-amber-500' },
  obese: { key: 'vitals.bmiObese', text: 'text-rose-700', bar: 'bg-rose-500' },
} as const;

/** Shkala: 15..40 kg/m² */
const SCALE_MIN = 15;
const SCALE_MAX = 40;
const scalePct = (v: number) =>
  `${Math.min(100, Math.max(0, ((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100))}%`;

export function UtIntakeVitalsPanel({
  weight,
  height,
  onWeightChange,
  onHeightChange,
}: UtIntakeVitalsPanelProps) {
  const { t } = useI18n();
  const bmi = bmiOf(weight, height);
  const style = bmi ? LEVEL_STYLE[bmi.level] : null;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label !text-xs !mb-1" htmlFor="ut-vazn">
            {t('vitals.weight')} <span className="text-red-500">*</span>
          </label>
          <input
            id="ut-vazn"
            type="number"
            inputMode="decimal"
            className={IN}
            value={weight}
            onChange={(e) => onWeightChange(e.target.value)}
            placeholder="70"
          />
        </div>
        <div>
          <label className="label !text-xs !mb-1" htmlFor="ut-boy">
            {t('vitals.height')} <span className="text-red-500">*</span>
          </label>
          <input
            id="ut-boy"
            type="number"
            inputMode="numeric"
            className={IN}
            value={height}
            onChange={(e) => onHeightChange(e.target.value)}
            placeholder="170"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3" aria-live="polite">
        <p className="text-xs font-semibold text-slate-500">{t('vitals.bmi')}</p>
        {bmi && style ? (
          <>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-brand-950">{bmi.value.toFixed(1)}</span>
              <span className="text-xs text-slate-400">kg/m²</span>
              <span className={cn('ml-auto text-xs font-semibold', style.text)}>{t(style.key)}</span>
            </p>
            <div className="relative mt-2.5 flex h-1.5 overflow-hidden rounded-full" aria-hidden>
              <span className="bg-sky-300" style={{ width: scalePct(18.5) }} />
              <span className="bg-emerald-300" style={{ width: `calc(${scalePct(25)} - ${scalePct(18.5)})` }} />
              <span className="bg-amber-300" style={{ width: `calc(${scalePct(30)} - ${scalePct(25)})` }} />
              <span className="flex-1 bg-rose-300" />
            </div>
            <div className="relative h-2" aria-hidden>
              <span
                className={cn('absolute top-0 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[1px]', style.bar)}
                style={{ left: scalePct(bmi.value) }}
              />
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{t('vitals.bmiHint')}</p>
        )}
      </div>
    </div>
  );
}
