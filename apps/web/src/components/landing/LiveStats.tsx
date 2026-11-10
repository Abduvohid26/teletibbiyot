'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Stethoscope, Users, Video, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/i18n';
import { resolveApiUrl } from '@/lib/api/http-client';

interface PublicStats {
  doctors: number;
  patients: number;
  consultations: number;
  facilities: number;
}

const ITEMS: { key: keyof PublicStats; icon: LucideIcon }[] = [
  { key: 'doctors', icon: Stethoscope },
  { key: 'patients', icon: Users },
  { key: 'consultations', icon: Video },
  { key: 'facilities', icon: Building2 },
];

const REFRESH_MS = 60_000;

/** 0 dan qiymatgacha yumshoq sanash animatsiyasi */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const base = from.current;
    const duration = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(base + (value - base) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown.toLocaleString('ru-RU')}</>;
}

export function LiveStats() {
  const { t } = useI18n();
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${resolveApiUrl()}/api/public/stats`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as PublicStats;
        if (alive) setStats(data);
      } catch {
        // Statistika ixtiyoriy — xato bo'lsa qator ko'rsatilmaydi
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!stats) return null;

  return (
    <div className="relative border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            {t('landing.liveStats.title')}
          </span>
          <span className="text-xs text-slate-500">· {t('landing.liveStats.note')}</span>
        </div>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {ITEMS.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-gold-400/40 hover:bg-white/[0.06]"
            >
              <Icon className="h-5 w-5 text-gold-400/80" aria-hidden />
              <dt className="mt-3 font-serif text-4xl font-semibold text-white">
                <CountUp value={stats[key]} />
              </dt>
              <dd className="mt-1 text-sm text-slate-400">{t(`landing.liveStats.${key}`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
