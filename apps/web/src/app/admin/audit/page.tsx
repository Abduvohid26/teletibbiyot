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

export default function AuditPage() {
  const { user, loading, authError, retryAuth } = useAuth();
  const router = useRouter();
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Audit yuklashda xatolik'));
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
      toast('CSV yuklab olindi', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Eksport xatosi', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <AuthLoadingScreen message="Yuklanmoqda..." error={authError} onRetry={retryAuth} />;
  }

  if (!user || !canAccessAudit(user.role)) return null;

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <Link href="/admin" className="btn-ghost !p-2">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 tracking-tight">Audit jurnali</h1>
              <p className="text-xs text-slate-500">{logs.length} ta yozuv</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <input type="date" className="input !py-1.5 !text-xs !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="input !py-1.5 !text-xs !w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
            <button type="button" onClick={exportCsv} disabled={exporting} className="btn-secondary !text-xs inline-flex items-center gap-1.5">
              <Download size={14} /> {exporting ? 'Eksport...' : 'CSV'}
            </button>
            <button type="button" onClick={load} className="btn-secondary !text-xs inline-flex items-center gap-1.5">
              <RefreshCw size={14} /> Yangilash
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5 mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={load} className="text-xs font-semibold underline">Qayta</button>
          </div>
        )}

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Vaqt</th>
                  <th className="px-4 py-3">Foydalanuvchi</th>
                  <th className="px-4 py-3">Harakat</th>
                  <th className="px-4 py-3">Ob&apos;ekt</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('uz-UZ')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{log.user?.fullName || '—'}</p>
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
                      Audit yozuvlari yo&apos;q
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
