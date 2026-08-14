'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api, SessionRecording } from '@/lib/api';
import { Video, Play, X } from 'lucide-react';
import { ROLES_MT_DASHBOARD } from '@/lib/roles';
import { useI18n } from '@/i18n';

interface RecordingRow extends SessionRecording {
  consultation?: {
    patient?: { fullName: string };
    utFacility?: { code: string };
    mtDoctor?: { fullName: string };
  };
}

export default function RecordingsPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useRequireAuth([...ROLES_MT_DASHBOARD]);
  const [items, setItems] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerTitle, setPlayerTitle] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    setError('');
    api.getCompletedRecordings()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : t('recordings.loadError')))
      .finally(() => setLoading(false));
  }, [authLoading, user, t]);

  if (authLoading || !user) return null;

  return (
    <DashboardLayout title={t('recordings.title')} subtitle={t('recordings.subtitle')}>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="panel p-4 animate-pulse h-14 bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('recordings.colPatient')}</th>
                <th>{t('recordings.colUt')}</th>
                <th>{t('recordings.colDoctor')}</th>
                <th>{t('recordings.colDuration')}</th>
                <th className="text-right">{t('recordings.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.consultation?.patient?.fullName ?? t('common.emptyDash')}</td>
                  <td>{r.consultation?.utFacility?.code ?? t('common.emptyDash')}</td>
                  <td>{r.consultation?.mtDoctor?.fullName ?? t('common.emptyDash')}</td>
                  <td>{r.duration ? t('common.minutesShort', { n: Math.round(r.duration / 60) }) : t('common.emptyDash')}</td>
                  <td className="text-right">
                    {r.playbackUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerUrl(r.playbackUrl!);
                          setPlayerTitle(r.consultation?.patient?.fullName || t('recordings.defaultTitle'));
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        <Play size={14} /> {t('common.view')}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">{t('common.unavailable')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="empty-state py-16">
              <Video size={32} className="mb-3 opacity-40" />
              <p>{t('recordings.empty')}</p>
            </div>
          )}
        </div>
      )}

      {playerUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPlayerUrl(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="font-semibold text-slate-900 truncate">{playerTitle}</p>
              <button type="button" onClick={() => setPlayerUrl(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <video src={playerUrl} controls autoPlay className="w-full max-h-[70vh] bg-black" />
            <div className="px-4 py-2 text-xs text-slate-500 border-t">
              {t('recordings.consentNote')}{' '}
              <a href={playerUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">
                {t('recordings.openInNew')}
              </a>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
