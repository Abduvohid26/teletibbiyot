'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Radio, Clock, ChevronRight, Stethoscope, UserPlus, FileText, Eye, Users } from 'lucide-react';
import { Consultation } from '@/lib/api';
import { formatStatus } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { UtQuickNav } from '@/components/ut/UtNavTabs';
import { ConsultationReportModal } from '@/components/consultations/ConsultationReportModal';
import { UtConsiliumModal } from '@/components/ut/UtConsiliumModal';
import { PdfDownloadButton } from '@/components/dashboard/PdfDownloadButton';
import { useI18n } from '@/i18n';

type Filter = 'all' | 'live' | 'queued' | 'tashxis';

interface UtPatientListProps {
  sessions: Consultation[];
  activeId?: string;
  onSelect: (id: string) => void;
  showGoLive?: boolean;
  sessionCount?: number;
  liveCount?: number;
  /** Konsilium tarkibi o'zgargach ro'yxatni yangilash */
  onReload?: () => void;
  /** Birinchi yuklash — bo'sh holat o'rniga skeleton */
  loading?: boolean;
}

function hasTashxis(c: Consultation) {
  return c.status === 'COMPLETED' && (Boolean(c.aiAnalysis) || Boolean(c.consultationReport));
}

export function UtPatientList({
  sessions,
  activeId,
  onSelect,
  showGoLive,
  sessionCount = 0,
  liveCount = 0,
  onReload,
  loading,
}: UtPatientListProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [diagnosisView, setDiagnosisView] = useState<Consultation | null>(null);
  const [consiliumView, setConsiliumView] = useState<Consultation | null>(null);

  const filtered = useMemo(() => {
    let list = sessions;
    if (filter === 'live') list = list.filter((c) => c.status === 'IN_PROGRESS');
    if (filter === 'queued') list = list.filter((c) => c.status === 'QUEUED');
    if (filter === 'tashxis') list = list.filter(hasTashxis);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.patient.fullName.toLowerCase().includes(q)
          || c.patient.phone?.includes(q)
          || c.patient.pinfl?.includes(q),
      );
    }
    return list;
  }, [sessions, filter, search]);

  const counts = useMemo(
    () => ({
      all: sessions.length,
      live: sessions.filter((c) => c.status === 'IN_PROGRESS').length,
      queued: sessions.filter((c) => c.status === 'QUEUED').length,
      tashxis: sessions.filter(hasTashxis).length,
    }),
    [sessions],
  );

  const handleSelect = (id: string) => {
    onSelect(id);
    if (showGoLive) router.push('/ut/vitals');
  };

  const tabs: { id: Filter; label: string; icon: React.ElementType; count: number; dot?: string }[] = [
    { id: 'all', label: t('common.all'), icon: Stethoscope, count: counts.all },
    { id: 'live', label: t('nav.liveShort'), icon: Radio, count: counts.live, dot: 'bg-emerald-500' },
    { id: 'queued', label: t('ut.queue'), icon: Clock, count: counts.queued, dot: 'bg-amber-500' },
    { id: 'tashxis', label: t('ut.filterDiagnosis'), icon: FileText, count: counts.tashxis, dot: 'bg-brand-600' },
  ];

  if (loading && sessions.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white" aria-busy="true">
        <div className="flex gap-1 border-b border-slate-100 p-2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
        <ul className="divide-y divide-slate-100">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2.5">
              <span className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                <span className="block h-2.5 w-1/5 animate-pulse rounded bg-slate-100" />
              </span>
              <span className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 text-center min-h-0">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Stethoscope className="h-7 w-7 text-brand-300" />
        </div>
        <div>
          <h2 className="font-bold text-brand-950 text-sm mb-1">{t('ut.noPatientsYet')}</h2>
          <p className="text-sm text-slate-500 max-w-xs">{t('ut.noPatientsHint')}</p>
        </div>
        <UtQuickNav sessionCount={sessionCount} liveCount={liveCount} />
        <Link href="/ut" className="gradient-btn !text-sm inline-flex items-center gap-1.5">
          <UserPlus size={14} /> {t('ut.admitPatient')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Filtr + qidiruv */}
        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 p-2 sm:flex-row sm:items-center">
          <div role="tablist" className="flex gap-1 overflow-x-auto ut-nav-scroll">
            {tabs.map(({ id, label, count, dot }) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                    active ? 'bg-brand-950 text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
                  {label}
                  <span
                    className={cn(
                      'min-w-[1.5rem] rounded-md px-1.5 py-0.5 text-center text-xs tabular-nums',
                      active ? 'bg-white/15 text-gold-300' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative sm:ml-auto sm:w-72">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('ut.searchPatients')}
              className="form-input ut-glass-input !min-h-[2.25rem] !py-1.5 !pl-8 !text-sm w-full"
            />
          </div>
        </div>

        {/* Ro'yxat */}
        <ul className="flex-1 min-h-0 divide-y divide-slate-100 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="py-10 text-center text-sm text-slate-500">
              {filter === 'tashxis' ? t('ut.noDiagnosesYet') : t('ut.noResults')}
            </li>
          ) : (
            filtered.map((c) => {
              const st = formatStatus(c.status);
              const isActive = c.id === activeId;
              const isLive = c.status === 'IN_PROGRESS';
              const isTashxis = hasTashxis(c);
              const primaryDx = c.aiAnalysis?.diagnoses?.[0];

              if (filter === 'tashxis' || (filter === 'all' && isTashxis)) {
                return (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <FileText size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-brand-950">{c.patient.fullName}</p>
                      <p className="truncate text-xs text-slate-500">
                        {primaryDx ? `${primaryDx.name} (${primaryDx.icd10Code})` : t('ut.filterDiagnosis')}
                        {c.mtDoctor?.fullName && ` · ${c.mtDoctor.fullName}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDiagnosisView(c)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700"
                      >
                        <Eye size={12} /> {t('ut.read')}
                      </button>
                      <PdfDownloadButton
                        consultationId={c.id}
                        hasReport={!!c.consultationReport}
                        compact
                      />
                    </div>
                  </li>
                );
              }

              const consiliumCount = c.participants?.length ?? 0;

              return (
                <li
                  key={c.id}
                  className={cn(
                    'relative flex items-center gap-3 px-3 py-2 transition-colors',
                    isActive ? 'bg-brand-50/70' : 'hover:bg-slate-50',
                  )}
                >
                  {(isActive || isLive) && (
                    <span
                      className={cn('absolute inset-y-1.5 left-0 w-[3px] rounded-r', isLive ? 'bg-emerald-500' : 'bg-brand-600')}
                      aria-hidden
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        isLive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {c.patient.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-brand-950">{c.patient.fullName}</p>
                      <p className="truncate text-xs text-slate-500 tabular-nums">{c.patient.phone || '—'}</p>
                    </div>
                    <p className="hidden w-48 min-w-0 truncate text-xs text-slate-600 md:block">
                      {c.mtDoctor?.fullName ?? '—'}
                    </p>
                    <span className={cn('status-badge w-24 shrink-0 justify-center', st.className)}>{t(st.labelKey)}</span>
                  </button>

                  {/* Konsilium — bemorga qo'shimcha shifokorlarni biriktirish */}
                  <button
                    type="button"
                    onClick={() => setConsiliumView(c)}
                    title={t('consilium.manage')}
                    className={cn(
                      'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors',
                      consiliumCount > 0
                        ? 'border-brand-200 bg-brand-50 text-brand-700'
                        : 'border-slate-200 text-slate-400 hover:border-brand-300 hover:text-brand-700',
                    )}
                  >
                    <Users size={12} />
                    {consiliumCount > 0 ? consiliumCount : ''}
                  </button>
                  <ChevronRight size={14} className="shrink-0 text-slate-300" />
                </li>
              );
            })
          )}
        </ul>
      </div>

      <ConsultationReportModal
        consultation={diagnosisView}
        open={!!diagnosisView}
        onClose={() => setDiagnosisView(null)}
      />

      <UtConsiliumModal
        consultation={consiliumView}
        open={!!consiliumView}
        onClose={() => setConsiliumView(null)}
        onChanged={onReload}
      />
    </>
  );
}
