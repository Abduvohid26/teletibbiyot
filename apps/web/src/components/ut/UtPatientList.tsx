'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Radio, Clock, ChevronRight, Stethoscope, UserPlus, FileText, Eye, Download } from 'lucide-react';
import { Consultation, api } from '@/lib/api';
import { formatStatus } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { UtQuickNav } from '@/components/ut/UtNavTabs';
import { UtDiagnosisModal } from '@/components/ut/UtDiagnosisModal';
import { useI18n } from '@/i18n';

type Filter = 'all' | 'live' | 'queued' | 'tashxis';

interface UtPatientListProps {
  sessions: Consultation[];
  activeId?: string;
  onSelect: (id: string) => void;
  showGoLive?: boolean;
  sessionCount?: number;
  liveCount?: number;
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
}: UtPatientListProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [diagnosisView, setDiagnosisView] = useState<Consultation | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  const handleDownload = async (c: Consultation, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(c.id);
    try {
      if (c.consultationReport) {
        const link = await api.getReportLink(c.id);
        window.open(link.url, '_blank', 'noopener,noreferrer');
      } else {
        await api.downloadAiAnalysisPdf(c.id);
      }
    } catch {
      /* toast handled by caller if needed */
    } finally {
      setDownloadingId(null);
    }
  };

  const tabs: { id: Filter; label: string; icon: React.ElementType; count: number; tone: string }[] = [
    { id: 'all', label: t('common.all'), icon: Stethoscope, count: counts.all, tone: 'text-slate-600' },
    { id: 'live', label: t('nav.liveShort'), icon: Radio, count: counts.live, tone: 'text-emerald-600' },
    { id: 'queued', label: t('ut.queue'), icon: Clock, count: counts.queued, tone: 'text-amber-700' },
    { id: 'tashxis', label: t('ut.filterDiagnosis'), icon: FileText, count: counts.tashxis, tone: 'text-violet-600' },
  ];

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 text-center min-h-0">
        <div className="ut-glass-empty">
          <Stethoscope className="w-7 h-7 text-slate-300" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800 text-sm mb-1">{t('ut.noPatientsYet')}</h2>
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
      <div className="flex flex-col flex-1 min-h-0 gap-2 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          {tabs.map(({ id, label, icon: Icon, count, tone }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                'rounded-xl px-2 py-2 text-left transition-all',
                filter === id ? 'ut-glass-card ut-glass-card-active' : 'ut-glass-card-interactive',
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <Icon size={14} className={filter === id ? 'text-brand-600' : tone} />
                <span className={cn('text-lg font-bold leading-none', filter === id ? 'text-brand-700' : 'text-slate-800')}>
                  {count}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-1">{label}</p>
            </button>
          ))}
        </div>

        <div className="relative shrink-0">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('ut.searchPatients')}
            className="form-input ut-glass-input !py-2 !pl-8 !text-sm w-full"
          />
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-1.5 content-start overflow-y-auto auto-rows-min">
          {filtered.length === 0 ? (
            <p className="col-span-full text-sm text-slate-500 text-center py-6">
              {filter === 'tashxis' ? t('ut.noDiagnosesYet') : t('ut.noResults')}
            </p>
          ) : (
            filtered.map((c) => {
              const st = formatStatus(c.status);
              const isActive = c.id === activeId;
              const isLive = c.status === 'IN_PROGRESS';
              const isTashxis = hasTashxis(c);
              const primaryDx = c.aiAnalysis?.diagnoses?.[0];

              if (filter === 'tashxis' || (filter === 'all' && isTashxis)) {
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'w-full px-3 py-2.5 flex items-center gap-2.5 text-left transition-all',
                      'ut-glass-card-interactive',
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold bg-violet-100/80 text-violet-700 ring-1 ring-violet-200/60">
                      <FileText size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate text-sm">{c.patient.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {primaryDx ? `${primaryDx.name} (${primaryDx.icd10Code})` : t('ut.filterDiagnosis')}
                        {c.mtDoctor?.fullName && ` · ${c.mtDoctor.fullName}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDiagnosisView(c)}
                        className="ut-glass-btn !text-[10px] !py-1 !px-2 inline-flex items-center gap-1"
                      >
                        <Eye size={12} /> {t('ut.read')}
                      </button>
                      <button
                        type="button"
                        disabled={downloadingId === c.id}
                        onClick={(e) => void handleDownload(c, e)}
                        className="gradient-btn !text-[10px] !py-1 !px-2 inline-flex items-center gap-1 disabled:opacity-60"
                      >
                        <Download size={12} />
                        {downloadingId === c.id ? '...' : 'PDF'}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className={cn(
                    'w-full px-3 py-2 flex items-center gap-2.5 text-left transition-all',
                    isActive ? 'ut-glass-card ut-glass-card-active' : 'ut-glass-card-interactive',
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold backdrop-blur-sm',
                      isLive ? 'bg-emerald-100/80 text-emerald-700 ring-1 ring-emerald-200/60' : 'bg-amber-100/80 text-amber-800 ring-1 ring-amber-200/60',
                    )}
                  >
                    {c.patient.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate text-sm">{c.patient.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {c.patient.phone || '—'}
                      {c.mtDoctor?.fullName && ` · ${c.mtDoctor.fullName}`}
                    </p>
                  </div>
                  <span className={cn('status-badge shrink-0', st.className)}>{t(st.labelKey)}</span>
                  <ChevronRight size={14} className="text-slate-300 shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {diagnosisView && (
        <UtDiagnosisModal
          consultation={diagnosisView}
          open
          onClose={() => setDiagnosisView(null)}
        />
      )}
    </>
  );
}
