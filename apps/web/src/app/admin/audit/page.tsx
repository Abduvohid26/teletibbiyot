'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, ArrowLeft, Shield, RefreshCw, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, AuditLog } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen';
import { canAccessAudit } from '@ishifo/shared';
import { toast } from '@/lib/toast';
import { LOCALE_BCP47, useI18n } from '@/i18n';

export default function AuditPage() {
  const { user, loading, authError, retryAuth } = useAuth();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!loading && user && !canAccessAudit(user.role)) router.replace('/unauthorized');
  }, [user, loading, router]);

  const load = () => {
    setError('');
    api.getAuditLogs()
      .then(setLogs)
      .catch((err) => setError(err instanceof Error ? err.message : t('admin.auditLoadError')));
  };

  useEffect(() => {
    if (!loading && user && canAccessAudit(user.role)) {
      load();
    }
  }, [user, loading]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = await api.downloadAuditCsv(from || undefined, to || undefined);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${from || 'all'}-${to || 'all'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast(t('admin.csvDownloaded'), 'success');
    } catch (err) {
      toast.error(t('admin.exportError'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <AuthLoadingScreen message={t('common.loading')} error={authError} onRetry={retryAuth} />;
  }

  if (!user || !canAccessAudit(user.role)) return null;

  return (
    <div className="min-h-screen bg-[#f2f4f8]">
      <header className="sticky top-0 z-20 border-b border-gold-400/25 bg-brand-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/admin"
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label={t('admin.title')}
          >
            <ArrowLeft size={18} />
          </Link>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-gold-400/40">
            <Shield className="h-5 w-5 text-gold-300" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-bold tracking-tight">{t('admin.auditTitle')}</h1>
            <p className="text-xs text-slate-400">{t('admin.auditCount', { count: logs.length })}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
          <input type="date" className="input !min-h-0 !w-auto !py-1.5 !text-xs" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-slate-300" aria-hidden>—</span>
          <input type="date" className="input !min-h-0 !w-auto !py-1.5 !text-xs" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={exportCsv} disabled={exporting} className="btn-secondary !min-h-0 !py-1.5 !text-xs inline-flex items-center gap-1.5">
              <Download size={14} /> {exporting ? t('admin.exporting') : t('admin.exportCsv')}
            </button>
            <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800">
              <RefreshCw size={14} /> {t('common.refresh')}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5 mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={load} className="text-xs font-semibold underline">{t('admin.retryShort')}</button>
          </div>
        )}

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">{t('admin.colTime')}</th>
                  <th className="px-4 py-3">{t('admin.colUser')}</th>
                  <th className="px-4 py-3">{t('admin.action')}</th>
                  <th className="px-4 py-3">{t('admin.colEntity')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString(LOCALE_BCP47[locale])}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{log.user?.fullName || t('common.emptyDash')}</p>
                      <p className="text-xs text-slate-500">{log.user?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.entity}
                      {log.entityId && <span className="text-xs text-slate-400 ml-1">#{log.entityId.slice(0, 8)}</span>}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !error && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      {t('admin.auditEmpty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
