'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Info, Loader2, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getRoleHomePath } from '@/lib/auth-utils';
import { BrandName } from '@/components/brand/BrandName';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { FjstiEmblem } from '@/components/brand/FjstiEmblem';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import { BRAND } from '@ishifo/shared';
import { Alert } from '@/components/ui/Alert';
import { FormField } from '@/components/ui/FormField';
import { LanguageSwitcher, useI18n } from '@/i18n';

const ROLES = [
  { key: 'ut', titleKey: 'roles.utOperator', bodyKey: 'login.roleUt', icon: Users },
  { key: 'doctor', titleKey: 'roles.mtDoctor', bodyKey: 'login.roleDoctor', icon: Stethoscope },
  { key: 'admin', titleKey: 'roles.admin', bodyKey: 'login.roleAdmin', icon: ShieldCheck },
] as const;

/** Faqat dev: seed hisoblar — bosilsa forma to'ldiriladi */
const DEV_ACCOUNTS = [
  { titleKey: 'roles.utOperator', email: 'operator@ishifo.uz' },
  { titleKey: 'roles.mtDoctor', email: 'doctor@ishifo.uz' },
  { titleKey: 'roles.admin', email: 'admin@ishifo.uz' },
] as const;
// Prod bundle'ga tushmasin — NODE_ENV build paytida almashtiriladi
const DEV_PASSWORD = process.env.NODE_ENV === 'development' ? 'password123' : '';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(t('login.fillBoth'));
      return;
    }
    setError('');
    setLoading(true);

    try {
      const result = await login(email.trim(), password);
      const role = result.user?.role || user?.role;
      if (!role) {
        setError(t('login.fail'));
        return;
      }

      window.location.href = getRoleHomePath(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  };

  return (
    // Desktopda sahifa aynan bir ekran — scroll yo'q; juda past ekranda faqat panel ichi scroll bo'ladi
    <div className="flex min-h-dvh bg-[#f2f4f8] lg:h-dvh lg:overflow-hidden">
      {/* Chap — brend paneli */}
      <aside className="relative hidden w-[46%] flex-col justify-between gap-6 overflow-y-auto bg-brand-950 px-10 py-9 text-white lg:flex xl:px-12 [@media(max-height:800px)]:gap-4 [@media(max-height:800px)]:py-5">
        {/* Dekoratsiya alohida qatlamda: absolute doira panel o'lchamini cho'zib, scroll paydo qilmasin */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="absolute -right-40 top-1/3 h-[30rem] w-[30rem] rounded-full bg-brand-600/30 blur-3xl" />
        </div>

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-3">
            <BrandLogo size={44} className="rounded-xl ring-1 ring-white/20" />
            <span>
              <BrandName size="xl" className="text-white" />
              <span className="block text-xs font-medium text-gold-300">
                {t('brand.platformOf', { name: BRAND.supporterShort })}
              </span>
            </span>
          </Link>

          <h1 className="mt-12 max-w-md font-serif text-[2.1rem] font-semibold leading-[1.15] xl:text-4xl [@media(max-height:800px)]:mt-5 [@media(max-height:800px)]:text-3xl">
            {t('login.heroTitle')}
          </h1>
          <p className="mt-4 max-w-md leading-relaxed text-slate-300 [@media(max-height:800px)]:mt-3 [@media(max-height:800px)]:text-sm">{t('login.heroBody')}</p>

          <div className="mt-9 max-w-md [@media(max-height:800px)]:mt-5">
            <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-gold-300">
              <span className="h-px w-8 bg-gold-400" />
              {t('login.rolesTitle')}
            </p>
            <ul className="mt-3 space-y-2">
              {ROLES.map(({ key, titleKey, bodyKey, icon: Icon }) => (
                <li key={key} className="flex items-center gap-3 rounded-xl bg-white/[0.05] px-4 py-2.5 ring-1 ring-white/10 [@media(max-height:800px)]:py-2">
                  <Icon size={18} className="shrink-0 text-gold-300" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t(titleKey)}</span>
                    <span className="block text-xs text-slate-400">{t(bodyKey)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative flex items-end justify-between gap-6">
          <PlatformFooter variant="dense" />
          <FjstiEmblem size={44} className="shrink-0 ring-white/20" />
        </div>
      </aside>

      {/* O'ng — forma */}
      <main className="flex flex-1 flex-col lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-950">
            <ArrowLeft size={15} /> {t('login.backHome')}
          </Link>
          <LanguageSwitcher compact />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-8 sm:px-8">
          <div className="w-full max-w-sm animate-slide-up">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <BrandLogo size={40} />
              <BrandName size="lg" className="text-brand-950" />
              <FjstiEmblem size={32} className="ml-auto" />
            </div>

            <h2 className="font-serif text-3xl font-semibold text-brand-950">{t('login.title')}</h2>
            <p className="mt-1.5 text-sm text-slate-500">{t('login.subtitle')}</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              {error && <Alert variant="error">{error}</Alert>}

              <FormField id="login-email" label={t('login.email')} required>
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input !rounded-lg"
                  placeholder="doctor@ishifo.uz"
                />
              </FormField>

              <FormField id="login-password" label={t('login.password')} required>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={onPasswordKey}
                    onKeyDown={onPasswordKey}
                    onBlur={() => setCapsLock(false)}
                    required
                    className="input !rounded-lg pr-11"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {capsLock && (
                  <p className="mt-1.5 text-xs font-medium text-amber-700" role="status">
                    {t('login.capsLock')}
                  </p>
                )}
              </FormField>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-[var(--touch-min)] w-full items-center justify-center gap-2 rounded-lg bg-brand-950 py-3 font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : null}
                {loading ? t('login.submitting') : t('login.submit')}
                {!loading && <ArrowRight size={16} className="text-gold-400" />}
              </button>

              <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
                {t('login.forgot')}
              </p>
            </form>

            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-500">{t('login.devAccounts')}</p>
                <div className="grid gap-1.5">
                  {DEV_ACCOUNTS.map((a) => (
                    <button
                      key={a.email}
                      type="button"
                      onClick={() => {
                        setEmail(a.email);
                        setPassword(DEV_PASSWORD);
                        setError('');
                      }}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-xs ring-1 ring-slate-200 hover:ring-brand-300"
                    >
                      <span className="font-semibold text-brand-950">{t(a.titleKey)}</span>
                      <span className="text-slate-500">{a.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-8 text-center text-xs text-slate-400">
              <a href="/privacy" className="hover:text-brand-700">{t('footer.privacy')}</a>
              {' · '}
              <a href="/terms" className="hover:text-brand-700">{t('footer.terms')}</a>
              {' · '}
              <a href={BRAND.openDataPath} className="hover:text-brand-700">{t('footer.openData')}</a>
            </p>

            <div className="mt-8 lg:hidden">
              <PlatformFooter variant="compact" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
