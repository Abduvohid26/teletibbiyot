'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  ClipboardList,
  FileImage,
  FileScan,
  FileText,
  HeartPulse,
  Languages,
  Mic,
  PhoneOff,
  ShieldCheck,
  Stethoscope,
  User,
  UserCog,
  Users,
  Video,
} from 'lucide-react';
import { BRAND, brandCopyright } from '@ishifo/shared';
import { BrandName } from '@/components/brand/BrandName';
import { LanguageSwitcher, useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

const FACTS = ['languages', 'intake', 'vitals', 'roles'] as const;

const STEPS = [
  { n: '1', icon: ClipboardList },
  { n: '2', icon: BrainCircuit },
  { n: '3', icon: Video },
] as const;

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
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">{t('landing.nav.features')}</a>
            <a href="#how" className="hover:text-slate-900">{t('landing.nav.how')}</a>
            <a href="#roles" className="hover:text-slate-900">{t('landing.nav.roles')}</a>
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher compact className="hidden sm:inline-flex" />
            <Link href={ctaHref} className="gradient-btn rounded-xl px-4 py-2 text-sm">
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/60 to-white">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgb(148 163 184 / 0.13) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.13) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'linear-gradient(to bottom, black 20%, transparent 90%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 90%)',
            }}
          />
          <div className="pointer-events-none absolute -top-32 right-0 h-[28rem] w-[28rem] rounded-full bg-brand-200/40 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-14 sm:px-6 lg:grid-cols-2 lg:pt-24">
            <div className="animate-slide-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-card">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {t('landing.hero.badge')}
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
                {t('landing.hero.title1')}{' '}
                <span className="bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  {t('landing.hero.title2')}
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                {t('landing.hero.body')}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={ctaHref} className="gradient-btn inline-flex items-center gap-2 rounded-xl px-6 py-3">
                  {t('landing.hero.ctaLogin')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 shadow-card hover:border-slate-300"
                >
                  <BookOpen className="h-4 w-4 text-brand-600" />
                  {t('landing.hero.ctaHow')}
                </a>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                {(['chipVideo', 'chipAi', 'chipLangs'] as const).map((k) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-500" />
                    {t(`landing.hero.${k}`)}
                  </li>
                ))}
              </ul>
            </div>

            <HeroMockup />
          </div>
        </section>

        {/* Facts */}
        <section className="border-y border-slate-100">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              {t('landing.facts.title')}
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-y-8 md:grid-cols-4 md:divide-x md:divide-slate-200">
              {FACTS.map((key) => (
                <div key={key} className="text-center">
                  <dt className="text-4xl font-extrabold tracking-tight text-slate-900">
                    {t(`landing.facts.${key}.value`)}
                  </dt>
                  <dd className="mt-2 text-sm text-slate-500">{t(`landing.facts.${key}.label`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Features — bento */}
        <section id="features" className="scroll-mt-20 bg-slate-50/70">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <SectionHead
              eyebrow={t('landing.features.eyebrow')}
              title={t('landing.features.title')}
              subtitle={t('landing.features.subtitle')}
            />
            <div className="mt-14 grid gap-5 md:grid-cols-6">
              <FeatureCard id="video" icon={Video} className="md:col-span-4"><VideoVisual /></FeatureCard>
              <FeatureCard id="ai" icon={BrainCircuit} className="md:col-span-2"><AiVisual /></FeatureCard>
              <FeatureCard id="vitals" icon={HeartPulse} className="md:col-span-2"><VitalsVisual /></FeatureCard>
              <FeatureCard id="intake" icon={ClipboardList} className="md:col-span-2"><IntakeVisual /></FeatureCard>
              <FeatureCard id="files" icon={FileScan} className="md:col-span-2"><FilesVisual /></FeatureCard>
              <FeatureCard id="langs" icon={Languages} className="md:col-span-3"><LangsVisual /></FeatureCard>
              <FeatureCard id="security" icon={ShieldCheck} className="md:col-span-3"><SecurityVisual /></FeatureCard>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <SectionHead eyebrow={t('landing.how.eyebrow')} title={t('landing.how.title')} />
            <ol className="mt-14 grid gap-10 md:grid-cols-3">
              {STEPS.map(({ n, icon: Icon }) => (
                <li key={n} className="text-center">
                  <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-brand-600 shadow-card">
                    <Icon className="h-6 w-6" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                      {n}
                    </span>
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">{t(`landing.how.step${n}.title`)}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-600">
                    {t(`landing.how.step${n}.body`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="scroll-mt-20 bg-slate-50/70">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <SectionHead eyebrow={t('landing.roles.eyebrow')} title={t('landing.roles.title')} />
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {ROLES.map(({ key, icon: Icon }) => (
                <article key={key} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
                  <IconTile icon={Icon} />
                  <h3 className="mt-5 text-lg font-bold text-slate-900">{t(`landing.roles.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(`landing.roles.${key}.body`)}</p>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-10 flex max-w-3xl items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0" />
              {t('landing.roles.aiNote')}
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-slate-50/70 px-4 pb-20 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-brand-900 to-indigo-900 px-6 py-16 text-center text-white sm:px-12">
            <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">{t('landing.cta.title')}</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-brand-100/90">{t('landing.cta.body')}</p>
            <Link
              href={ctaHref}
              className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-slate-900 shadow-lg hover:bg-brand-50"
            >
              {t('landing.cta.button')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-slate-500">{t('landing.footer.about')}</p>
            <LanguageSwitcher compact className="mt-5" />
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
            <span className="text-slate-400">{t('footer.patent')}: {BRAND.patent}</span>
          </FooterCol>
        </div>
        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:justify-between sm:px-6">
            <span>{brandCopyright()}</span>
            <span>{t('footer.developer')}: {BRAND.developer}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ───────── kichik bloklar ───────── */

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-700 text-white shadow-glow">
        <Stethoscope className="h-5 w-5" />
      </span>
      <BrandName size="lg" className="text-slate-900" />
      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
        {BRAND.supporterShort}
      </span>
    </Link>
  );
}

function IconTile({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
      <Icon className="h-5 w-5" />
    </span>
  );
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-slate-600">{subtitle}</p>}
    </div>
  );
}

function FeatureCard({
  id,
  icon,
  className,
  children,
}: {
  id: string;
  icon: React.ElementType;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <article className={cn('flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card', className)}>
      <IconTile icon={icon} />
      <h3 className="mt-5 text-lg font-bold text-slate-900">{t(`landing.features.${id}.title`)}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(`landing.features.${id}.body`)}</p>
      <div className="mt-6 flex-1 content-end" aria-hidden="true">{children}</div>
    </article>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-4 flex flex-col gap-2.5 text-sm text-slate-500 [&_a:hover]:text-brand-600">{children}</div>
    </div>
  );
}

/* ───────── kartochka illyustratsiyalari (faqat vizual) ───────── */

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

function VideoVisual() {
  return (
    <div className="grid grid-cols-[1.6fr_1fr] gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="relative flex h-32 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-indigo-950">
        <User className="h-8 w-8 text-white/70" />
        <span className="absolute left-2 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
        <div className="absolute bottom-2 right-2 flex gap-1">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15"><Mic className="h-2.5 w-2.5 text-white" /></span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500"><PhoneOff className="h-2.5 w-2.5 text-white" /></span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-1 items-center justify-center rounded-lg bg-slate-700">
          <Stethoscope className="h-5 w-5 text-white/70" />
        </div>
        <div className="space-y-1.5 rounded-lg bg-white p-2">
          <span className="block h-1.5 w-full rounded bg-slate-200" />
          <span className="block h-1.5 w-2/3 rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

function AiVisual() {
  const rows = [
    { w: 'w-4/5', c: 'bg-violet-400' },
    { w: 'w-1/2', c: 'bg-violet-300' },
    { w: 'w-1/3', c: 'bg-violet-200' },
  ];
  return (
    <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-1.5 w-10 rounded bg-slate-200" />
          <span className={cn('h-2 rounded-full', r.w, r.c)} />
        </div>
      ))}
    </div>
  );
}

function VitalsVisual() {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <EcgLine className="h-8 w-full text-rose-500" />
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-bold">
        <span className="rounded-md bg-white py-1 text-rose-600">72</span>
        <span className="rounded-md bg-white py-1 text-brand-700">135/85</span>
        <span className="rounded-md bg-white py-1 text-emerald-600">97%</span>
      </div>
    </div>
  );
}

function IntakeVisual() {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                s <= 3 ? 'bg-emerald-500 text-white' : 'border border-slate-300 bg-white text-slate-400',
              )}
            >
              {s <= 3 ? <Check className="h-3 w-3" /> : s}
            </span>
            {s < 5 && <span className={cn('mx-1 h-0.5 flex-1', s < 3 ? 'bg-emerald-400' : 'bg-slate-200')} />}
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5 rounded-lg bg-white p-2">
        <span className="block h-1.5 w-full rounded bg-slate-200" />
        <span className="block h-1.5 w-3/5 rounded bg-slate-200" />
      </div>
    </div>
  );
}

function FilesVisual() {
  const files = [
    { icon: FileText, name: 'xulosa.pdf', c: 'text-rose-500' },
    { icon: FileImage, name: 'rentgen.jpg', c: 'text-sky-500' },
    { icon: FileScan, name: 'MRT.dcm', c: 'text-violet-500' },
  ];
  return (
    <div className="space-y-2">
      {files.map(({ icon: Icon, name, c }) => (
        <div key={name} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Icon className={cn('h-4 w-4', c)} />
          {name}
        </div>
      ))}
    </div>
  );
}

function LangsVisual() {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      {(['uz', 'ru', 'en'] as const).map((code) => (
        <div key={code} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
            {code.toUpperCase()}
          </span>
          {t(`landing.features.langs.sample.${code}`)}
        </div>
      ))}
    </div>
  );
}

function SecurityVisual() {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      {(['log1', 'log2', 'log3'] as const).map((k) => (
        <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            {t(`landing.features.security.${k}`)}
          </span>
          <span className="h-1.5 w-10 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

/** Konsultatsiya oynasining soddalashtirilgan ko'rinishi — faqat vizual */
function HeroMockup() {
  const { t } = useI18n();
  const vitals = [
    { label: t('landing.mock.pulse'), value: '72', unit: 'bpm', color: 'text-rose-600' },
    { label: t('landing.mock.bp'), value: '135/85', unit: 'mmHg', color: 'text-brand-700' },
    { label: 'SpO₂', value: '97', unit: '%', color: 'text-emerald-600' },
    { label: t('landing.mock.temp'), value: '36.8', unit: '°C', color: 'text-amber-600' },
  ];

  return (
    <div className="relative animate-fade-in" aria-hidden="true">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-glass-lg">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="ml-3 flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500">
            <Stethoscope className="h-3 w-3 text-brand-600" />
            {BRAND.domain}
          </span>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-[1.4fr_1fr]">
          <div className="relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 p-3 text-white">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 rounded-md bg-rose-500 px-2 py-0.5 font-bold">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                {t('landing.mock.live')}
              </span>
              <span className="rounded-md bg-white/10 px-2 py-0.5">{t('landing.mock.specialty')}</span>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                <User className="h-8 w-8 text-white/80" />
              </span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xs text-white/80">{t('landing.mock.patient')}</span>
              <div className="flex gap-1.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15"><Mic className="h-3.5 w-3.5" /></span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15"><Video className="h-3.5 w-3.5" /></span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500"><PhoneOff className="h-3.5 w-3.5" /></span>
              </div>
            </div>
            <div className="absolute right-3 top-10 flex h-14 w-20 items-center justify-center rounded-lg bg-slate-700/80 ring-1 ring-white/20">
              <Stethoscope className="h-5 w-5 text-white/70" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <Activity className="h-3.5 w-3.5" /> {t('landing.mock.vitals')}
              </p>
              <EcgLine className="mt-2 h-6 w-full text-rose-500" />
              <dl className="mt-2 grid grid-cols-2 gap-2">
                {vitals.map((v) => (
                  <div key={v.label} className="rounded-lg bg-white px-2 py-1.5">
                    <dt className="text-[10px] text-slate-400">{v.label}</dt>
                    <dd className={cn('text-sm font-bold', v.color)}>
                      {v.value} <span className="text-[10px] font-medium text-slate-400">{v.unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700">
                <BrainCircuit className="h-3.5 w-3.5" /> {t('landing.mock.aiTitle')}
              </p>
              <p className="mt-1.5 text-xs font-semibold text-slate-800">{t('landing.mock.aiRisk')}</p>
              <div className="mt-2 space-y-1.5">
                <span className="block h-1.5 w-full rounded bg-violet-200/70" />
                <span className="block h-1.5 w-4/5 rounded bg-violet-200/70" />
              </div>
              <p className="mt-2 text-[10px] text-slate-500">{t('landing.mock.aiNote')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-3 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-card-hover sm:flex">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </span>
        {t('landing.mock.ecg')}
      </div>
      <div className="absolute -right-3 -top-6 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-card-hover sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50">
          <Users className="h-4 w-4 text-brand-600" />
        </span>
        <span>
          <span className="block font-semibold text-slate-800">{t('landing.mock.queue')}</span>
          <span className="block text-[10px] text-slate-400">{t('landing.mock.queueSub')}</span>
        </span>
      </div>
    </div>
  );
}
