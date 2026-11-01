'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { DoctorOption } from '@/lib/api';
import { loadLabel, presenceDotClass, presenceHint, presenceLabel } from '@/lib/doctor-presence';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface ConsiliumDoctorPickerProps {
  /** Hali konsiliumda bo'lmagan shifokorlar (bo'shlari tepada) */
  options: DoctorOption[];
  busy: boolean;
  /** Tanlanganlarni qo'shadi; muvaffaqiyatli bo'lsa true */
  onAdd: (doctorIds: string[]) => Promise<boolean>;
  className?: string;
}

/**
 * Konsiliumga bir nechta shifokorni BIR YO'LA taklif qilish.
 * Har bir shifokor yonida hozirgi holati (online / Meetda / tanaffus / offline)
 * va yuklamasi ko'rinadi — kimni chaqirish mumkinligi darhol tushunarli.
 */
export function ConsiliumDoctorPicker({ options, busy, onAdd, className }: ConsiliumDoctorPickerProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);

  // Ro'yxatdan chiqib ketgan (boshqa joyda qo'shilgan) shifokorlar tanlovda qolmasin
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => options.some((d) => d.id === id)));
  }, [options]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (!selected.length) return;
    if (await onAdd(selected)) setSelected([]);
  };

  if (options.length === 0) {
    return (
      <p className={cn('px-1 py-2 text-xs text-slate-500', className)}>{t('consilium.noDoctors')}</p>
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <ul className="max-h-64 min-h-0 space-y-1 overflow-y-auto overscroll-contain pr-0.5" role="listbox" aria-multiselectable="true">
        {options.map((d) => {
          const checked = selected.includes(d.id);
          const spec = d.specialtyRef?.name || d.specialty;
          return (
            <li key={d.id}>
              <button
                type="button"
                role="option"
                aria-selected={checked}
                disabled={busy}
                onClick={() => toggle(d.id)}
                title={presenceHint(d.presence, t)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ring-1 transition-colors disabled:opacity-60',
                  checked ? 'bg-brand-50 ring-brand-300' : 'bg-white ring-slate-200 hover:bg-slate-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    checked ? 'border-brand-950 bg-brand-950 text-white' : 'border-slate-300 bg-white',
                  )}
                >
                  {checked && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-900">{d.fullName}</span>
                  {spec && <span className="block truncate text-[11px] text-slate-500">{spec}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                  <span className={cn('h-2 w-2 rounded-full', presenceDotClass(d.presence))} />
                  {presenceLabel(d.presence, t)}
                  <span className="hidden sm:inline">· {loadLabel(d, t)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!selected.length || busy}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-950 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
        {selected.length
          ? t('consilium.inviteSelected', { count: selected.length })
          : t('consilium.pickDoctors')}
      </button>
    </div>
  );
}
