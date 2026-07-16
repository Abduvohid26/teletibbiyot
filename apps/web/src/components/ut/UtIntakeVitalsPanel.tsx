'use client';

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
    <div className="h-full grid grid-cols-2 gap-2 content-start">
      <div>
        <label className="label !text-sm !mb-1" htmlFor="ut-vazn">
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
        <label className="label !text-sm !mb-1" htmlFor="ut-boy">
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
  );
}
