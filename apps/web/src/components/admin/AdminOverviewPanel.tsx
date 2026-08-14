'use client';

import Link from 'next/link';
import { Activity, Building2, Stethoscope, Users, FileText } from 'lucide-react';
import { AdminOverview } from '@/lib/api';
import { UserRole } from '@ishifo/shared';
import { LOCALE_BCP47, useI18n } from '@/i18n';

interface AdminOverviewPanelProps {
  overview: AdminOverview | null;
  loading: boolean;
  onRetry?: () => void;
}

function StatCard({ icon: Icon, label, value, bg, text }: {
  icon: React.ElementType;
  label: string;
  value: number;
  bg: string;
  text: string;
}) {
  return (
    <div className="stat-card">
      <div className={`p-3 rounded-xl ${bg}`}>
        <Icon className={text} size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function roleLabelKey(role: string): string {
  if (role === UserRole.UT_OPERATOR) return 'roles.utOperator';
  if (role === UserRole.MT_DOCTOR) return 'roles.mtDoctor';
  if (role === UserRole.ADMIN) return 'roles.admin';
  return role;
}

export function AdminOverviewPanel({ overview, loading, onRetry }: AdminOverviewPanelProps) {
  const { t, locale } = useI18n();

  if (loading) {
    return <div className="text-sm text-slate-500 animate-pulse py-8">{t('admin.statsLoading')}</div>;
  }

  if (!overview) {
    return (
      <div className="text-sm text-slate-500 py-8 flex flex-col items-center gap-3">
        <p>{t('admin.statsFailed')}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-secondary !text-xs">
            {t('common.retry')}
          </button>
        )}
      </div>
    );
  }

  const { summary, operatorStats, doctorStats, facilityStats, recentAudit } = overview;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard icon={Activity} label={t('admin.totalIntakes')} value={summary.totalConsultations} bg="bg-brand-50" text="text-brand-600" />
        <StatCard icon={Users} label={t('admin.utOperators')} value={summary.utOperators} bg="bg-cyan-50" text="text-cyan-600" />
        <StatCard icon={Stethoscope} label={t('admin.doctors')} value={summary.mtDoctors} bg="bg-emerald-50" text="text-emerald-600" />
        <StatCard icon={Building2} label={t('admin.utFacilities')} value={summary.utFacilities} bg="bg-amber-50" text="text-amber-600" />
        <StatCard icon={Building2} label={t('admin.mtCenters')} value={summary.mtFacilities} bg="bg-violet-50" text="text-violet-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="panel overflow-hidden">
          <div className="panel-header">
            <Users size={18} className="text-brand-600" />
            <span className="panel-title">{t('admin.operatorsIntakes')}</span>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('admin.colOperator')}</th>
                  <th>{t('admin.facility')}</th>
                  <th className="text-right">{t('admin.colIntakes')}</th>
                </tr>
              </thead>
              <tbody>
                {operatorStats.map((op) => (
                  <tr key={op.id}>
                    <td>
                      <p className="font-semibold text-slate-800">{op.fullName}</p>
                      <p className="text-xs text-slate-400">{op.email}</p>
                    </td>
                    <td className="text-slate-500">{op.facility?.name || t('common.emptyDash')}</td>
                    <td className="text-right font-bold text-brand-700">{op.intakes}</td>
                  </tr>
                ))}
                {operatorStats.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-slate-500 py-6">{t('admin.noOperators')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="panel-header">
            <Stethoscope size={18} className="text-brand-600" />
            <span className="panel-title">{t('admin.doctorsConsultations')}</span>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('admin.colDoctor')}</th>
                  <th>{t('admin.specialty')}</th>
                  <th className="text-right">{t('admin.colTotal')}</th>
                  <th className="text-right">{t('admin.colCompleted')}</th>
                  <th className="text-right">{t('admin.colInProgressShort')}</th>
                </tr>
              </thead>
              <tbody>
                {doctorStats.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <p className="font-semibold text-slate-800">{doc.fullName}</p>
                      <p className="text-xs text-slate-400">{doc.facility?.name || t('common.emptyDash')}</p>
                    </td>
                    <td className="text-slate-500">{doc.specialty || t('common.emptyDash')}</td>
                    <td className="text-right font-bold">{doc.total}</td>
                    <td className="text-right text-emerald-600">{doc.completed}</td>
                    <td className="text-right text-amber-600">{doc.inProgress + doc.queued}</td>
                  </tr>
                ))}
                {doctorStats.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-6">{t('admin.noDoctors')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-header">
          <Building2 size={18} className="text-brand-600" />
          <span className="panel-title">{t('admin.facilityIntakes')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('admin.facility')}</th>
                <th>{t('admin.code')}</th>
                <th className="text-right">{t('admin.colIntakes')}</th>
              </tr>
            </thead>
            <tbody>
              {facilityStats.map((f) => (
                <tr key={f.id}>
                  <td className="font-semibold text-slate-800">{f.name}</td>
                  <td className="text-slate-500">{f.code}</td>
                  <td className="text-right font-bold text-brand-700">{f.intakes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-header">
          <FileText size={18} className="text-brand-600" />
          <span className="panel-title">{t('admin.recentAudit')}</span>
          <Link href="/admin/audit" className="ml-auto text-xs font-medium text-brand-600 hover:underline">
            {t('admin.seeAll')}
          </Link>
        </div>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('admin.colTime')}</th>
                <th>{t('admin.colUser')}</th>
                <th>{t('admin.action')}</th>
                <th>{t('admin.colEntity')}</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((log) => (
                <tr key={log.id}>
                  <td className="text-slate-500 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString(LOCALE_BCP47[locale])}
                  </td>
                  <td>
                    <p className="font-medium text-slate-800">{log.user?.fullName || t('common.emptyDash')}</p>
                    <p className="text-xs text-slate-400">{log.user?.role ? t(roleLabelKey(log.user.role)) : ''}</p>
                  </td>
                  <td className="text-xs font-mono text-slate-600">{log.action}</td>
                  <td className="text-xs text-slate-500">{log.entity}</td>
                </tr>
              ))}
              {recentAudit.length === 0 && (
                <tr><td colSpan={4} className="text-center text-slate-500 py-6">{t('admin.noAudit')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
