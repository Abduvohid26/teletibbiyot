'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BrainCircuit,
  ClipboardList,
  FileScan,
  HeartPulse,
  Languages,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
  Video,
} from 'lucide-react';
import { BRAND, brandCopyright } from '@ishifo/shared';
import { BrandName } from '@/components/brand/BrandName';
import { FjstiEmblem } from '@/components/brand/FjstiEmblem';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LanguageSwitcher, useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

const FACTS = ['languages', 'intake', 'vitals', 'roles'] as const;

const FEATURES = [
  { id: 'video', icon: Video },
  { id: 'ai', icon: BrainCircuit },
  { id: 'vitals', icon: HeartPulse },
  { id: 'intake', icon: ClipboardList },
  { id: 'files', icon: FileScan },
  { id: 'langs', icon: Languages },
  { id: 'security', icon: ShieldCheck },
] as const;

const STEPS = ['1', '2', '3'] as const;

const ROLES = [
  { key: 'ut', icon: Users },
  { key: 'doctor', icon: Stethoscope },
  { key: 'admin', icon: UserCog },
] as const;

export function LandingPage() {
  const { t } = useI18n();
  const ctaHref = '/login';
  const ctaLabel = t('landing.nav.login');

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header — navy, hero bilan bir butun */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-950/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo tone="dark" />

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
            <a href="#features" className="hover:text-gold-300">{t('landing.nav.features')}</a>
            <a href="#how" className="hover:text-gold-300">{t('landing.nav.how')}</a>
            <a href="#roles" className="hover:text-gold-300">{t('landing.nav.roles')}</a>
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher compact tone="dark" className="hidden sm:inline-flex" />
            <Link
              href={ctaHref}
              className="rounded-lg bg-gold-400 px-4 py-2 text-sm font-semibold text-brand-950 hover:bg-gold-300"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-brand-950 text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="pointer-events-none absolute -right-40 top-10 h-[34rem] w-[34rem] rounded-full bg-brand-600/30 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:pt-20">
            <div className="animate-slide-up">
              <p className="flex items-center gap-3 text-sm font-medium text-gold-300">
                <FjstiEmblem size={28} className="ring-white/20" />
                {t('landing.hero.badge')}
              </p>
              <h1 className="mt-7 font-serif text-4xl font-semibold leading-[1.12] sm:text-5xl lg:text-[3.35rem]">
                {t('landing.hero.title1')}{' '}
                <span className="text-gold-400">{t('landing.hero.title2')}</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
                {t('landing.hero.body')}
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href={ctaHref}
                  className="inline-flex min-h-[var(--touch-min)] items-center gap-2 rounded-lg bg-gold-400 px-6 py-3 font-semibold text-brand-950 hover:bg-gold-300"
                >
                  {t('landing.hero.ctaLogin')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex min-h-[var(--touch-min)] items-center gap-2 rounded-lg border border-white/20 px-6 py-3 font-semibold text-white hover:border-white/40 hover:bg-white/5"
                >
                  {t('landing.hero.ctaHow')}
                </a>
              </div>

              <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                {(['chipVideo', 'chipAi', 'chipLangs'] as const).map((k, i) => (
                  <span key={k} className="flex items-center gap-3">
                    {i > 0 && <span className="h-1 w-1 rounded-full bg-gold-500/70" />}
                    {t(`landing.hero.${k}`)}
                  </span>
                ))}
              </p>
            </div>

            <NetworkVisual />
          </div>

          {/* Raqamlar */}
          <div className="relative border-t border-white/10">
            <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4">
              {FACTS.map((key) => (
                <div key={key} className="flex items-baseline gap-3 md:border-l md:border-white/10 md:pl-6 md:first:border-l-0 md:first:pl-0">
                  <dt className="font-serif text-4xl font-semibold text-gold-400">
                    {t(`landing.facts.${key}.value`)}
                  </dt>
                  <dd className="text-sm leading-snug text-slate-400">{t(`landing.facts.${key}.label`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Imkoniyatlar — raqamlangan ro'yxat */}
        <section id="features" className="scroll-mt-20">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:py-28">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Eyebrow>{t('landing.features.eyebrow')}</Eyebrow>
              <h2 className="mt-4 font-serif text-3xl font-semibold leading-tight text-brand-950 sm:text-4xl">
                {t('landing.features.title')}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">{t('landing.features.subtitle')}</p>
            </div>

            <ol className="grid gap-x-10 sm:grid-cols-2">
              {FEATURES.map(({ id, icon: Icon }, i) => (
                <li key={id} className="border-t border-slate-200 py-7">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-serif text-sm font-semibold text-gold-600">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-brand-950">{t(`landing.features.${id}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(`landing.features.${id}.body`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Qanday ishlaydi — vaqt chizig'i */}
        <section id="how" className="scroll-mt-20 bg-brand-50/70">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <Eyebrow>{t('landing.how.eyebrow')}</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-serif text-3xl font-semibold leading-tight text-brand-950 sm:text-4xl">
              {t('landing.how.title')}
            </h2>

            <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              <span className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-brand-200 md:left-0 md:top-[7px] md:h-px md:w-full" />
              {STEPS.map((n) => (
                <li key={n} className="relative pl-10 md:pl-0 md:pt-10">
                  <span className="absolute left-0 top-0.5 h-[15px] w-[15px] rounded-full border-[3px] border-brand-50 bg-gold-400 ring-1 ring-gold-500 md:top-0" />
                  <span className="font-serif text-5xl font-semibold text-brand-200">0{n}</span>
                  <h3 className="mt-3 text-lg font-bold text-brand-950">{t(`landing.how.step${n}.title`)}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600">
                    {t(`landing.how.step${n}.body`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Kimlar uchun */}
        <section id="roles" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <Eyebrow>{t('landing.roles.eyebrow')}</Eyebrow>
                <h2 className="mt-4 max-w-xl font-serif text-3xl font-semibold leading-tight text-brand-950 sm:text-4xl">
                  {t('landing.roles.title')}
                </h2>
              </div>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {ROLES.map(({ key, icon: Icon }) => (
                <article key={key} className="rounded-xl border border-slate-200 border-t-gold-400 bg-white p-6 [border-top-width:3px]">
                  <Icon className="h-6 w-6 text-brand-700" />
                  <h3 className="mt-4 text-lg font-bold text-brand-950">{t(`landing.roles.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(`landing.roles.${key}.body`)}</p>
                </article>
              ))}
            </div>

            <p className="mt-8 flex items-start gap-3 rounded-xl bg-brand-950 px-5 py-4 text-sm leading-relaxed text-slate-200">
              <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
              {t('landing.roles.aiNote')}
            </p>
          </div>
        </section>

        {/* Yakuniy CTA — oltin chiziq */}
        <section className="border-y border-gold-200 bg-gold-50">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <h2 className="font-serif text-2xl font-semibold text-brand-950 sm:text-3xl">{t('landing.cta.title')}</h2>
              <p className="mt-2 text-slate-600">{t('landing.cta.body')}</p>
            </div>
            <Link
              href={ctaHref}
              className="inline-flex min-h-[var(--touch-min)] shrink-0 items-center gap-2 rounded-lg bg-brand-950 px-6 py-3 font-semibold text-white hover:bg-brand-800"
            >
              {t('landing.cta.button')}
              <ArrowRight className="h-4 w-4 text-gold-400" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-brand-950 text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo tone="dark" />
            <p className="mt-4 max-w-xs text-sm">{t('landing.footer.about')}</p>
            <LanguageSwitcher compact tone="dark" className="mt-5" />
          </div>
          <FooterCol title={t('landing.footer.platform')}>
            <a href="#features">{t('landing.nav.features')}</a>
            <a href="#how">{t('landing.nav.how')}</a>
            <a href="#roles">{t('landing.nav.roles')}</a>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </FooterCol>
          <FooterCol title={t('landing.footer.info')}>
            <Link href="/privacy">{t('footer.privacy')}</Link>
            <Link href="/terms">{t('footer.terms')}</Link>
            <Link href={BRAND.openDataPath}>{t('footer.openData')}</Link>
            <span className="text-slate-500">{t('footer.patent')}: {BRAND.patent}</span>
          </FooterCol>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-6">
            <span>{brandCopyright()}</span>
            <span>{t('footer.developer')}: {BRAND.developer}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ───────── kichik bloklar ───────── */

function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <BrandLogo size={36} className={dark ? 'ring-1 ring-white/15' : undefined} />
      <BrandName size="lg" className={dark ? 'text-white' : 'text-brand-950'} />
      <span
        className={cn(
          'ml-1 hidden items-center gap-1.5 border-l pl-2.5 sm:inline-flex',
          dark ? 'border-white/15' : 'border-slate-200',
        )}
      >
        <FjstiEmblem size={26} className={dark ? 'ring-white/20' : undefined} />
        <span className={cn('text-[11px] font-bold', dark ? 'text-slate-400' : 'text-slate-500')}>
          {BRAND.supporterShort}
        </span>
      </span>
    </Link>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-gold-600">
      <span className="h-px w-8 bg-gold-400" />
      {children}
    </p>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-4 flex flex-col gap-2.5 text-sm [&_a:hover]:text-gold-300">{children}</div>
    </div>
  );
}

function EcgLine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 24" className={className} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        points="0,14 18,14 22,14 25,4 28,22 31,14 50,14 58,14 61,4 64,22 67,14 86,14 94,14 97,4 100,22 103,14 120,14"
      />
    </svg>
  );
}

/* ───────── hero: tuman muassasalari ↔ markaziy shifoxona tarmog'i ───────── */

const VIEW = { w: 480, h: 400 };
const CENTER = { x: 250, y: 170 };
const NODES = [
  { x: 70, y: 70, label: true },
  { x: 420, y: 60, label: false },
  { x: 450, y: 220, label: true },
  { x: 370, y: 330, label: false },
  { x: 60, y: 250, label: false },
  { x: 170, y: 20, label: false },
];

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

function NetworkVisual() {
  const { t } = useI18n();
  const vitals = [
    { label: t('landing.mock.pulse'), value: '72', color: 'text-rose-600' },
    { label: t('landing.mock.bp'), value: '135/85', color: 'text-brand-700' },
    { label: 'SpO₂', value: '97%', color: 'text-emerald-600' },
  ];

  return (
    <div className="relative mx-auto aspect-[6/5] w-full max-w-lg animate-fade-in" aria-hidden="true">
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="absolute inset-0 h-full w-full">
        <circle cx={CENTER.x} cy={CENTER.y} r="120" fill="none" stroke="rgb(255 255 255 / 0.08)" />
        <circle cx={CENTER.x} cy={CENTER.y} r="190" fill="none" stroke="rgb(255 255 255 / 0.05)" />
        {NODES.map((n, i) => (
          <g key={i}>
            <line x1={n.x} y1={n.y} x2={CENTER.x} y2={CENTER.y} stroke="rgb(255 255 255 / 0.14)" strokeWidth="1" />
            <line
              x1={n.x}
              y1={n.y}
              x2={CENTER.x}
              y2={CENTER.y}
              stroke="#e2b43d"
              strokeWidth="1.5"
              strokeDasharray="4 12"
              strokeLinecap="round"
              className="animate-dash-flow"
              style={{ animationDelay: `${i * -0.3}s` }}
            />
            <circle cx={n.x} cy={n.y} r="6" fill="#0b1b45" stroke="#8fa5d4" strokeWidth="1.5" />
          </g>
        ))}
      </svg>

      {/* Tuman muassasalari yorliqlari */}
      {NODES.filter((n) => n.label).map((n, i) => (
        <span
          key={i}
          className="absolute -translate-x-1/2 translate-y-3 whitespace-nowrap rounded-md border border-white/10 bg-brand-900/90 px-2 py-0.5 text-[11px] text-slate-300"
          style={{ left: pct(n.x, VIEW.w), top: pct(n.y, VIEW.h) }}
        >
          {t('landing.network.node')}
        </span>
      ))}

      {/* Markaziy shifoxona */}
      <div
        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        style={{ left: pct(CENTER.x, VIEW.w), top: pct(CENTER.y, VIEW.h) }}
      >
        <span className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brand-900 ring-2 ring-gold-400">
          <span className="absolute inset-0 animate-ring-pulse rounded-full ring-2 ring-gold-400" />
          <BrandLogo size={52} className="rounded-full shadow-none" />
        </span>
        <span className="mt-3 whitespace-nowrap text-sm font-semibold text-white">{t('landing.network.center')}</span>
        <span className="whitespace-nowrap text-[11px] text-gold-300">{t('landing.network.centerSub')}</span>
      </div>

      {/* Navbat */}
      <span className="absolute right-0 top-[38%] flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs shadow-lg sm:right-2">
        <Users className="h-3.5 w-3.5 text-brand-600" />
        <span className="text-slate-500">{t('landing.network.queue')}:</span>
        <span className="font-bold text-brand-950">3</span>
      </span>

      {/* Jonli konsultatsiya kartasi */}
      <div className="absolute bottom-0 left-0 w-[min(17rem,80%)] rounded-xl bg-white p-3.5 text-slate-900 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-bold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            {t('landing.network.live')}
          </span>
          <Video className="h-3.5 w-3.5 text-slate-400" />
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">{t('landing.network.liveSub')}</p>
        <EcgLine className="mt-2 h-6 w-full text-rose-500" />
        <dl className="mt-2 grid grid-cols-3 gap-1.5">
          {vitals.map((v) => (
            <div key={v.label} className="rounded-md bg-slate-50 px-2 py-1">
              <dt className="truncate text-[10px] text-slate-400">{v.label}</dt>
              <dd className={cn('text-xs font-bold', v.color)}>{v.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
