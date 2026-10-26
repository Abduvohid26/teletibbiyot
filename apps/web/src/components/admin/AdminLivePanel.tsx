'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  HardDrive,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { api, AdminLive } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LOCALE_BCP47, useI18n } from '@/i18n';

const REFRESH_MS = 15_000;
const LONG_WAIT_MIN = 30;

const TRIAGE: Record<string, { key: string; className: string; dot: string }> = {
  EMERGENCY: { key: 'clinical.triageEmergency', className: 'bg-rose-600 text-white', dot: 'bg-rose-600' },
  HIGH: { key: 'clinical.triageHigh', className: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200', dot: 'bg-orange-500' },
  MEDIUM: { key: 'clinical.triageMedium', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', dot: 'bg-amber-500' },
  LOW: { key: 'clinical.triageLow', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
};

const PRESENCE: Record<AdminLive['doctors'][number]['presence'], { key: string; dot: string; order: number }> = {
  in_meet: { key: 'adminLive.presInMeet', dot: 'bg-emerald-500', order: 0 },
  online: { key: 'adminLive.presOnline', dot: 'bg-emerald-400', order: 1 },
  break: { key: 'adminLive.presBreak', dot: 'bg-orange-400', order: 2 },
  offline: { key: 'adminLive.presOffline', dot: 'bg-slate-300', order: 3 },
};

/** Admin monitoring: tizimning joriy holati, avtomatik yangilanadi */
export function AdminLivePanel() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<AdminLive | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      setData(await api.getAdminLive());
      setError(false);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Tab ko'rinib turganda va pauza bo'lmasa — har 15 soniyada
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    const onVisible = () => !document.hidden && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [paused, load]);

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-sm text-slate-500">
        {error ? (
          <>
            <p>{t('adminLive.loadFailed')}</p>
            <button type="button" onClick={() => void load()} className="btn-secondary !text-xs">
              {t('common.retry')}
            </button>
          </>
        ) : (
          <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="h-20 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        )}
      </div>
    );
  }

  const c = data.counters;
  // 45 daq · 3 soat 20 daq · 12 kun — katta sonlar o'qilmay qolmasin
  const minutes = (n: number | null) => {
    if (n == null) return '—';
    if (n < 60) return t('adminLive.minutes', { n });
    if (n < 24 * 60) {
      const h = Math.floor(n / 60);
      const m = n % 60;
      return m ? t('adminLive.hoursMinutes', { h, m }) : t('adminLive.hours', { h });
    }
    return t('adminLive.days', { d: Math.floor(n / (24 * 60)) });
  };
  const onlineDoctors = data.doctors.filter((d) => d.presence !== 'offline').length;
  const updatedAt = new Date(data.generatedAt).toLocaleTimeString(LOCALE_BCP47[locale], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const alerts: { tone: 'red' | 'amber'; text: string }[] = [];
  if (data.system.database === 'down') alerts.push({ tone: 'red', text: t('adminLive.alertSystem', { service: t('adminLive.sysDatabase') }) });
  if (data.system.storage === 'down') alerts.push({ tone: 'red', text: t('adminLive.alertSystem', { service: t('adminLive.sysStorage') }) });
  if (c.emergencyQueued > 0) alerts.push({ tone: 'red', text: t('adminLive.alertUrgent', { count: c.emergencyQueued }) });
  if (c.queued > 0 && onlineDoctors === 0) alerts.push({ tone: 'red', text: t('adminLive.alertNoDoctors') });
  if (c.unassignedQueued > 0) alerts.push({ tone: 'amber', text: t('adminLive.alertUnassigned', { count: c.unassignedQueued }) });
  if ((c.maxWaitMinutes ?? 0) >= LONG_WAIT_MIN) alerts.push({ tone: 'amber', text: t('adminLive.alertLongWait', { min: minutes(c.maxWaitMinutes) }) });

  const kpis = [
    { label: t('adminLive.kpiQueued'), value: c.queued, sub: c.maxWaitMinutes != null ? t('adminLive.kpiMaxWait', { min: minutes(c.maxWaitMinutes) }) : null, dot: 'bg-amber-500' },
    { label: t('adminLive.kpiLive'), value: c.inProgress, dot: 'bg-emerald-500' },
    { label: t('adminLive.kpiIntakes'), value: c.intakesToday, dot: 'bg-brand-600' },
    { label: t('adminLive.kpiCompleted'), value: c.completedToday, dot: 'bg-gold-500' },
    { label: t('adminLive.kpiCancelled'), value: c.cancelledToday, dot: 'bg-rose-500' },
    { label: t('adminLive.kpiAvgWait'), value: minutes(c.avgWaitMinutes), dot: 'bg-sky-500' },
    { label: t('adminLive.kpiAvgDuration'), value: minutes(c.avgDurationTodayMinutes), dot: 'bg-brand-400' },
  ];

  const doctors = [...data.doctors].sort(
    (a, b) => PRESENCE[a.presence].order - PRESENCE[b.presence].order || b.inProgress + b.queued - (a.inProgress + a.queued),
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Sarlavha + yangilanish */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-brand-950">
            <span className={cn('h-2 w-2 rounded-full', paused ? 'bg-slate-400' : 'animate-pulse bg-emerald-500')} />
            {t('adminLive.title')}
          </h2>
          <p className="text-sm text-slate-500">{t('adminLive.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="tabular-nums">{t('adminLive.updated', { time: updatedAt })}</span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:border-brand-300"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            {paused ? t('adminLive.resume') : t('adminLive.pause')}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-950 px-2.5 py-1.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
            {t('adminLive.refresh')}
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
            <p className="truncate text-2xl font-bold leading-none tabular-nums text-brand-950">{k.value}</p>
            <p className="mt-2 flex items-center gap-1.5 truncate text-xs font-semibold text-slate-500">
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', k.dot)} />
              {k.label}
            </p>
            {k.sub && <p className="mt-0.5 truncate text-[11px] text-slate-400">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Diqqat */}
      {alerts.length > 0 ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700">
            <AlertTriangle size={14} /> {t('adminLive.alertsTitle')}
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {alerts.map((a) => (
              <li
                key={a.text}
                className={cn(
                  'flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1',
                  a.tone === 'red' ? 'text-rose-800 ring-rose-200' : 'text-amber-800 ring-amber-200',
                )}
              >
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.tone === 'red' ? 'bg-rose-500' : 'bg-amber-500')} />
                {a.text}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={16} /> {t('adminLive.allGood')}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Chap: jonli + navbat */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card icon={Radio} iconClass="text-emerald-600" title={t('adminLive.liveTitle')} count={data.live.length}>
            {data.live.length === 0 ? (
              <Empty text={t('adminLive.liveEmpty')} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.live.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                    <FacilityTag facility={l.facility} />
                    <span className="text-slate-300" aria-hidden>→</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-950">
                      {l.doctor?.fullName ?? t('adminLive.unassigned')}
                      {l.consultants > 0 && (
                        <span className="ml-1.5 text-xs font-medium text-brand-600">
                          {t('adminLive.consultants', { n: l.consultants })}
                        </span>
                      )}
                    </span>
                    <TriageTag level={l.triageLevel} />
                    <span className="w-24 shrink-0 whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-600">
                      {minutes(l.minutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card icon={Users} iconClass="text-amber-600" title={t('adminLive.queueTitle')} count={c.queued}>
            {data.queue.length === 0 ? (
              <Empty text={t('adminLive.queueEmpty')} />
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {data.queue.map((q) => {
                    const wait = q.waitMinutes ?? 0;
                    return (
                      <li key={q.id} className="flex items-center gap-3 px-3 py-2">
                        <TriageTag level={q.triageLevel} />
                        <FacilityTag facility={q.facility} />
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-sm',
                            q.doctor ? 'text-slate-700' : 'font-semibold text-amber-700',
                          )}
                        >
                          {q.doctor?.fullName ?? t('adminLive.unassigned')}
                        </span>
                        <span
                          className={cn(
                            'w-24 shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-right text-xs font-semibold tabular-nums',
                            wait >= LONG_WAIT_MIN ? 'bg-rose-50 text-rose-700' : wait >= 15 ? 'bg-amber-50 text-amber-700' : 'text-slate-500',
                          )}
                        >
                          {minutes(q.waitMinutes)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {c.queued > data.queue.length && (
                  <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                    {t('adminLive.queueMore', { n: c.queued - data.queue.length })}
                  </p>
                )}
              </>
            )}
          </Card>
        </div>

        {/* O'ng: shifokorlar, muassasalar, tizim */}
        <div className="min-w-0 space-y-4">
          <Card
            icon={Stethoscope}
            iconClass="text-brand-600"
            title={t('adminLive.doctorsTitle')}
            aside={t('adminLive.doctorsOnline', { n: onlineDoctors, total: data.doctors.length })}
          >
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {doctors.map((d) => {
                const p = PRESENCE[d.presence];
                return (
                  <li key={d.id} className="flex items-center gap-2.5 px-3 py-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', p.dot)} title={t(p.key)} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-semibold', d.presence === 'offline' ? 'text-slate-400' : 'text-brand-950')}>
                        {d.fullName}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {t(p.key)}
                        {d.specialty ? ` · ${d.specialty}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1 text-[11px] tabular-nums">
                      <Mini value={d.queued} label={t('adminLive.docQueue')} tone="amber" />
                      <Mini value={d.inProgress} label={t('adminLive.docLive')} tone="emerald" />
                      <Mini value={d.completedToday} label={t('adminLive.docDone')} tone="slate" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card icon={Building2} iconClass="text-brand-600" title={t('adminLive.facilitiesTitle')} count={data.facilities.length}>
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {data.facilities.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="shrink-0 rounded-md bg-brand-950 px-1.5 py-0.5 text-[10px] font-bold text-gold-300">{f.code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-950">{f.name}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {t('adminLive.facOperators', { n: f.operators })} · {t('adminLive.facToday', { n: f.intakesToday })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1 text-[11px] tabular-nums">
                    <Mini value={f.queued} label={t('adminLive.docQueue')} tone="amber" />
                    <Mini value={f.inProgress} label={t('adminLive.docLive')} tone="emerald" />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card icon={ShieldCheck} iconClass="text-brand-600" title={t('adminLive.systemTitle')}>
            <ul className="divide-y divide-slate-100">
              <SystemRow icon={Database} label={t('adminLive.sysDatabase')} up={data.system.database === 'up'} />
              <SystemRow icon={HardDrive} label={t('adminLive.sysStorage')} up={data.system.storage === 'up'} />
            </ul>
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
              {t('adminLive.privacyNote')}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ───────── kichik bloklar ───────── */

function Card({
  icon: Icon,
  iconClass,
  title,
  count,
  aside,
  children,
}: {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  count?: number;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <Icon size={15} className={iconClass} />
        <h3 className="text-sm font-bold text-brand-950">{title}</h3>
        {count != null && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{count}</span>
        )}
        {aside && <span className="ml-auto text-xs font-medium text-slate-500">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-3 py-8 text-center text-sm text-slate-400">{text}</p>;
}

function FacilityTag({ facility }: { facility: { code: string; name: string } }) {
  return (
    <span className="max-w-[9rem] shrink-0 truncate text-xs text-slate-500" title={facility.name}>
      <span className="font-bold text-brand-950">{facility.code}</span>
      <span className="hidden sm:inline"> · {facility.name}</span>
    </span>
  );
}

function TriageTag({ level }: { level: string | null }) {
  const { t } = useI18n();
  const triage = level ? TRIAGE[level] : undefined;
  if (!triage) return <span className="w-20 shrink-0" />;
  return (
    <span className={cn('w-20 shrink-0 truncate rounded-full px-2 py-0.5 text-center text-[11px] font-semibold', triage.className)}>
      {t(triage.key)}
    </span>
  );
}

function Mini({ value, label, tone }: { value: number; label: string; tone: 'amber' | 'emerald' | 'slate' }) {
  const active = value > 0;
  return (
    <span
      title={label}
      className={cn(
        'min-w-[1.75rem] rounded-md px-1.5 py-0.5 text-center font-semibold',
        !active && 'bg-slate-50 text-slate-300',
        active && tone === 'amber' && 'bg-amber-50 text-amber-700',
        active && tone === 'emerald' && 'bg-emerald-50 text-emerald-700',
        active && tone === 'slate' && 'bg-slate-100 text-slate-600',
      )}
    >
      {value}
    </span>
  );
}

function SystemRow({ icon: Icon, label, up }: { icon: React.ElementType; label: string; up: boolean }) {
  const { t } = useI18n();
  return (
    <li className="flex items-center gap-2.5 px-3 py-2 text-sm">
      <Icon size={14} className="text-slate-400" />
      <span className="flex-1 text-slate-700">{label}</span>
      <span className={cn('flex items-center gap-1.5 text-xs font-semibold', up ? 'text-emerald-700' : 'text-rose-700')}>
        <span className={cn('h-2 w-2 rounded-full', up ? 'bg-emerald-500' : 'bg-rose-500')} />
        {up ? t('adminLive.up') : t('adminLive.down')}
      </span>
    </li>
  );
}
