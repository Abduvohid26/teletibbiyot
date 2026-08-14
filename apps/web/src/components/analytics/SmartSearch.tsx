'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, Stethoscope, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { formatStatus } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { UserRole, isMtStaff } from '@ishifo/shared';
import { useI18n } from '@/i18n';

const SEARCH_ROLES = new Set<string>([UserRole.MT_DOCTOR]);

export function SmartSearch({ className }: { className?: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof api.globalSearch>> | null>(null);
  const debounced = useDebouncedValue(query, 300);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    api.globalSearch(debounced)
      .then(setResults)
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [debounced]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasResults = results && (results.patients.length > 0 || results.consultations.length > 0);

  if (!user || !SEARCH_ROLES.has(user.role)) return null;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 w-full">
        {loading ? <Loader2 size={16} className="text-brand-500 animate-spin shrink-0" /> : <Search size={16} className="text-slate-400 shrink-0" />}
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t('search.placeholder')}
          className="bg-transparent text-sm w-full outline-none placeholder:text-slate-400"
        />
      </div>

      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 panel shadow-xl z-50 max-h-80 overflow-y-auto">
          {!hasResults && !loading && (
            <p className="p-4 text-sm text-slate-400 text-center">{t('search.noResults')}</p>
          )}
          {results?.patients.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('search.patients')}</p>
              {results.patients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { router.push(`/dashboard/patients?search=${encodeURIComponent(p.fullName)}`); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-50 text-left transition-colors"
                >
                  <div className="p-1.5 rounded-lg bg-brand-100"><User size={14} className="text-brand-600" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.fullName}</p>
                    <p className="text-xs text-slate-500">{p.phone} · {p.district}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
          {results?.consultations.length ? (
            <div className="p-2 border-t border-slate-100">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('search.consultations')}</p>
              {results.consultations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (c.status === 'IN_PROGRESS' || c.status === 'QUEUED') {
                      router.push('/dashboard');
                    } else {
                      router.push('/dashboard/consultations');
                    }
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-violet-50 text-left transition-colors"
                >
                  <div className="p-1.5 rounded-lg bg-violet-100"><Stethoscope size={14} className="text-violet-600" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.patient.fullName}</p>
                    <p className="text-xs text-slate-500">{c.utFacility.code} · {t(formatStatus(c.status).labelKey)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
