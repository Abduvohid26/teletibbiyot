'use client';

import { useState } from 'react';
import { Stethoscope, Eye, EyeOff, Activity, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getRoleHomePath } from '@/lib/auth-utils';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import { BRAND } from '@ishifo/shared';
import { Alert } from '@/components/ui/Alert';
import { FormField } from '@/components/ui/FormField';
import { LanguageSwitcher, useI18n } from '@/i18n';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
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

  return (
    <div className="min-h-screen flex bg-surface">
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden p-12 flex-col justify-between text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-indigo-700 to-violet-800" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl tracking-tight"><BrandName size="xl" className="text-white" /></h1>
              <p className="text-brand-200 text-sm font-medium">
                {t('brand.platformOf', { name: BRAND.supporterShort })}
              </p>
            </div>
          </div>
          <h2 className="text-4xl font-extrabold leading-tight mb-5 tracking-tight">
            {t('login.heroTitle')}
          </h2>
          <p className="text-brand-100 text-lg leading-relaxed max-w-lg">
            {t('login.heroBody')}
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 max-w-md">
            <FeaturePill icon={Activity} text={t('login.featureVideo')} />
            <FeaturePill icon={Lock} text={t('login.featureSecure')} />
          </div>
        </div>

        <div className="relative z-10">
          <PlatformFooter variant="dark" />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md animate-slide-up">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-btn flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl text-slate-900"><BrandName size="lg" /></h1>
          </div>

          <div className="panel p-8 shadow-panel">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="text-2xl font-bold text-slate-900">{t('login.title')}</h2>
              <LanguageSwitcher compact />
            </div>
            <p className="text-slate-500 mb-7 text-sm">{t('login.subtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {error && <Alert variant="error">{error}</Alert>}

              <FormField id="login-email" label={t('login.email')} required>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input"
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
                    required
                    className="input pr-11"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2 rounded-lg"
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              <button
                type="submit"
                disabled={loading}
                className="w-full gradient-btn py-3 rounded-xl disabled:opacity-50"
              >
                {loading ? t('login.submitting') : t('login.submit')}
              </button>
            </form>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 panel p-4 border-dashed">
              <p className="text-xs font-semibold text-slate-600 mb-2">Test hisoblar (faqat dev):</p>
              <div className="space-y-1 text-xs text-slate-500">
                <p>UT Operator: operator@ishifo.uz</p>
                <p>MT Shifokor: doctor@ishifo.uz</p>
                <p>Admin: admin@ishifo.uz</p>
                <p>Parol: password123</p>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-slate-400">
            <a href="/privacy" className="hover:text-brand-600">{t('footer.privacy')}</a>
            {' · '}
            <a href="/terms" className="hover:text-brand-600">{t('footer.terms')}</a>
            {' · '}
            <a href={BRAND.openDataPath} className="hover:text-brand-600">{t('footer.openData')}</a>
          </p>

          <div className="mt-8 lg:hidden">
            <PlatformFooter variant="compact" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 ring-1 ring-white/15">
      <Icon size={16} />
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}
