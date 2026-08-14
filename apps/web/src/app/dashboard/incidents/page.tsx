'use client';

import { FormEvent, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AuthPageGate } from '@/components/auth/AuthLoadingScreen';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import { toUserMessage } from '@/lib/utils';
import { AlertTriangle, Send } from 'lucide-react';
import { UserRole } from '@ishifo/shared';
import { useI18n } from '@/i18n';

const INCIDENT_ROLES = [UserRole.UT_OPERATOR, UserRole.MT_DOCTOR] as const;

export default function IncidentsPage() {
  const { t } = useI18n();
  const { user, loading, authError, retryAuth } = useRequireAuth([...INCIDENT_ROLES]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const severityOptions = [
    { value: 'LOW' as const, label: t('incidents.severityLow') },
    { value: 'MEDIUM' as const, label: t('incidents.severityMedium') },
    { value: 'HIGH' as const, label: t('incidents.severityHigh') },
    { value: 'CRITICAL' as const, label: t('incidents.severityCritical') },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      await api.reportIncident({ title: title.trim(), description: description.trim(), severity });
      setMessage(t('incidents.success'));
      setTitle('');
      setDescription('');
      setSeverity('MEDIUM');
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageGate loading={loading} user={user} authError={authError} retryAuth={retryAuth}>
      <DashboardLayout
        title={t('incidents.title')}
        subtitle={t('incidents.subtitle')}
      >
        <div className="max-w-2xl space-y-4">
          <div className="panel p-4 bg-amber-50/60 border-amber-100 text-sm text-amber-900 flex gap-3">
            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
            <p>{t('incidents.warning')}</p>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3">{error}</div>}
          {message && <div className="bg-emerald-50 text-emerald-800 text-sm rounded-xl p-3">{message}</div>}

          <form onSubmit={handleSubmit} className="panel p-5 space-y-4">
            <div>
              <label htmlFor="incident-title" className="block text-sm font-medium text-slate-700 mb-1">
                {t('common.title')}
              </label>
              <input
                id="incident-title"
                className="input w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                minLength={3}
                required
                placeholder={t('incidents.titlePlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="incident-severity" className="block text-sm font-medium text-slate-700 mb-1">
                {t('incidents.severity')}
              </label>
              <select
                id="incident-severity"
                className="input w-full"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as typeof severity)}
              >
                {severityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="incident-description" className="block text-sm font-medium text-slate-700 mb-1">
                {t('common.description')}
              </label>
              <textarea
                id="incident-description"
                className="input w-full min-h-[140px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                minLength={10}
                required
                placeholder={t('incidents.descriptionPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Send size={16} />
              {submitting ? t('common.submitting') : t('incidents.submit')}
            </button>
          </form>
        </div>
      </DashboardLayout>
    </AuthPageGate>
  );
}
