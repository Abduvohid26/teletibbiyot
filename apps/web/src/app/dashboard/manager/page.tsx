'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { AuthPageGate } from '@/components/auth/AuthLoadingScreen';
import { api, SlaMetrics } from '@/lib/api';
import { DoctorAiAgreement } from '@/lib/analytics-types';
import { toUserMessage } from '@/lib/utils';
import { Activity, AlertTriangle, Brain, Clock, Video, Download } from 'lucide-react';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { ROLES_MT_MANAGER } from '@/lib/roles';

export default function ManagerSlaPage() {
  const { user, loading, authError, retryAuth } = useRequireAuth([...ROLES_MT_MANAGER]);
  const [sla, setSla] = useState<SlaMetrics | null>(null);
  const [aiAgreement, setAiAgreement] = useState<DoctorAiAgreement[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setDataLoading(true);
    Promise.all([
      api.getSlaMetrics().then(setSla),
      api.getAnalyticsAiAgreementByDoctor({ period: '30d' }).then(setAiAgreement),
    ])
      .catch((err) => setError(toUserMessage(err)))
      .finally(() => setDataLoading(false));
  }, []);

  useConsultationRealtime([], {
    onConsultationStarted: () => load(),
    onConsultationCompleted: () => load(),
  }, { staffFeed: true });

  useEffect(() => {
    if (loading || !user) return;
    load();
  }, [user, loading, load]);

  const exportCsv = async () => {
    try {
      const csv = await api.downloadConsultationsCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'konsultatsiyalar.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('CSV eksport xatosi');
    }
  };

  return (
    <AuthPageGate loading={loading} user={user} authError={authError} retryAuth={retryAuth}>
      <DashboardLayout
        title="SLA va KPI monitoring"
        actions={
          <button type="button" onClick={exportCsv} className="btn-secondary !text-xs inline-flex items-center gap-1.5">
            <Download size={14} /> CSV eksport
          </button>
        }
      >
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3 mb-4">{error}</div>}
        {dataLoading && !sla && (
          <div className="text-sm text-slate-500 mb-4 animate-pulse">SLA ko&apos;rsatkichlari yuklanmoqda...</div>
        )}
        {sla && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard icon={Clock} label="O'rtacha kutish" value={`${sla.avgWaitMinutes} daq`} />
            <MetricCard icon={Activity} label="O'rtacha davomiylik" value={`${sla.avgDurationMinutes} daq`} />
            <MetricCard icon={AlertTriangle} label="SLA buzilish" value={String(sla.breachCount)} alert={sla.breachCount > 0} />
            <MetricCard icon={Video} label="Video muvaffaqiyat" value={`${sla.videoSuccessRate}%`} />
          </div>
        )}

        <div className="panel overflow-hidden">
          <div className="panel-header">
            <Brain size={16} />
            <span className="panel-title">Shifokor — AI kelishuvi (30 kun)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-4 py-3">Shifokor</th>
                  <th className="px-4 py-3">Konsultatsiyalar</th>
                  <th className="px-4 py-3">AI tasdiqlangan</th>
                  <th className="px-4 py-3">Kelishuv %</th>
                </tr>
              </thead>
              <tbody>
                {aiAgreement.map((row) => (
                  <tr key={row.doctorId} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.doctorName}</td>
                    <td className="px-4 py-3 text-slate-600">{row.totalCases}</td>
                    <td className="px-4 py-3 text-slate-600">{row.matchedCases}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${row.matchRate >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {row.matchRate}%
                      </span>
                    </td>
                  </tr>
                ))}
                {aiAgreement.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Ma&apos;lumot yo&apos;q</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardLayout>
    </AuthPageGate>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`panel p-4 ${alert ? 'border-red-200 bg-red-50/40' : ''}`}>
      <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
        <Icon size={14} />
        {label}
      </div>
      <p className={`text-2xl font-bold ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
