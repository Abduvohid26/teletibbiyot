'use client';

import { ReactNode } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'search' | 'date';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  value: string;
  className?: string;
}

interface SmartFilterBarProps {
  fields: FilterField[];
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  activeCount?: number;
  children?: ReactNode;
}

export function SmartFilterBar({ fields, onChange, onReset, activeCount = 0, children }: SmartFilterBarProps) {
  const { t } = useI18n();
  return (
    <div className="panel p-4 animate-slide-up">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 shrink-0">
          <Filter size={16} className="text-brand-600" />
          {t('filter.smart')}
          {activeCount > 0 && (
            <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </div>

        {fields.map((field) => (
          <div key={field.key} className={cn('min-w-[140px] flex-1', field.className)}>
            {field.type === 'search' || field.type === 'date' ? (
              <input
                type={field.type === 'date' ? 'date' : 'text'}
                value={field.value}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder || field.label}
                aria-label={field.label}
                title={field.label}
                className="input !py-2 !text-sm w-full"
              />
            ) : (
              <select
                value={field.value}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="input !py-2 !text-sm w-full cursor-pointer"
              >
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </div>
        ))}

        {children}

        {activeCount > 0 && (
          <button type="button" onClick={onReset} className="btn-ghost !text-xs shrink-0">
            <RotateCcw size={14} /> {t('filter.clear')}
          </button>
        )}
      </div>
    </div>
  );
}

export function countActiveFilters(filters: Record<string, string | undefined>, exclude: string[] = []): number {
  return Object.entries(filters).filter(([k, v]) => !exclude.includes(k) && v).length;
}
