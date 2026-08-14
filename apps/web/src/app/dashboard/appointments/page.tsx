'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api, Appointment, Facility, Patient } from '@/lib/api';
import { Calendar, Clock, User, MapPin, CheckCircle2, XCircle, Plus, X } from 'lucide-react';
import { toast } from '@/lib/toast';
import { safeAsync } from '@/lib/errors';
import { ROLES_MT_DASHBOARD, ROLES_UT } from '@/lib/roles';
import { isUtRole, isMtStaff } from '@ishifo/shared';
import { useI18n } from '@/i18n';
import { LOCALE_BCP47 } from '@/i18n/locales';

export default function AppointmentsPage() {
  const { t, locale } = useI18n();
  const { user, loading: authLoading } = useRequireAuth([...ROLES_MT_DASHBOARD, ...ROLES_UT]);
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [doctors, setDoctors] = useState<Array<{ id: string; fullName: string }>>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [form, setForm] = useState({
    patientId: '',
    facilityId: '',
    doctorId: '',
    scheduledAt: '',
    notes: '',
  });

  const canCreate = isMtStaff(user?.role || '') || isUtRole(user?.role || '');

  const load = () => {
    setLoading(true);
    api.getUpcomingAppointments(14)
      .then(setItems)
      .catch((e) => toast(e instanceof Error ? e.message : t('errors.generic'), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  useEffect(() => {
    if (!showCreate) return;
    void safeAsync('facilities', () => api.getFacilities(), []).then(setFacilities);
    void safeAsync('doctors', () => api.getDoctors(), []).then(setDoctors);
  }, [showCreate]);

  useEffect(() => {
    if (patientSearch.length < 2) {
      setPatients([]);
      return;
    }
    const timer = setTimeout(() => {
      api.getPatients({ search: patientSearch, limit: 8 })
        .then((r) => setPatients(r.items))
        .catch(() => setPatients([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.updateAppointmentStatus(id, status);
      toast(t('appointments.statusUpdated'), 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('errors.generic'), 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId || !form.facilityId || !form.scheduledAt) {
      toast(t('appointments.requiredFields'), 'error');
      return;
    }
    setCreating(true);
    try {
      await api.createAppointment({
        patientId: form.patientId,
        facilityId: form.facilityId,
        doctorId: form.doctorId || undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        notes: form.notes || undefined,
      });
      toast(t('appointments.created'), 'success');
      setShowCreate(false);
      setForm({ patientId: '', facilityId: '', doctorId: '', scheduledAt: '', notes: '' });
      setPatientSearch('');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('errors.generic'), 'error');
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <DashboardLayout
      title={t('appointments.title')}
      subtitle={t('appointments.subtitle')}
      actions={
        canCreate ? (
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary !text-xs">
            <Plus size={14} /> {t('appointments.newAppointment')}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {loading && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
        {!loading && items.length === 0 && (
          <div className="panel p-10 text-center text-slate-500">
            <Calendar className="mx-auto mb-3 opacity-40" size={32} />
            <p>{t('appointments.empty')}</p>
          </div>
        )}
        <div className="grid gap-3">
          {items.map((a) => (
            <div key={a.id} className="panel p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-slate-900 flex items-center gap-2">
                  <User size={16} className="text-brand-600" />
                  {a.patient.fullName}
                </p>
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <Clock size={14} />
                  {new Date(a.scheduledAt).toLocaleString(LOCALE_BCP47[locale])}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <MapPin size={14} />
                  {a.facility.code} — {a.facility.name}
                  {a.doctor && ` · ${a.doctor.fullName}`}
                </p>
                {a.notes && <p className="text-xs text-slate-500">{a.notes}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => updateStatus(a.id, 'COMPLETED')}
                  className="btn-secondary !py-1.5 !text-xs inline-flex items-center gap-1"
                >
                  <CheckCircle2 size={14} /> {t('appointments.done')}
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(a.id, 'CANCELLED')}
                  className="text-xs text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg inline-flex items-center gap-1"
                >
                  <XCircle size={14} /> {t('common.cancelShort')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="panel p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900">{t('appointments.newAppointment')}</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="label">{t('appointments.searchPatient')}</label>
                <input
                  className="form-input"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder={t('filters.searchPinPhone')}
                />
                {patients.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setForm({ ...form, patientId: p.id }); setPatientSearch(p.fullName); setPatients([]); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 ${form.patientId === p.id ? 'bg-brand-50 font-medium' : ''}`}
                      >
                        {p.fullName} · {p.phone}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label">{t('common.facility')}</label>
                <select className="form-input" required value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>
                  <option value="">{t('common.select')}</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('common.doctorOptional')}</label>
                <select className="form-input" value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                  <option value="">{t('common.notSelected')}</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('appointments.dateTime')}</label>
                <input type="datetime-local" className="form-input" required value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('common.notes')}</label>
                <textarea className="form-input min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">{t('common.cancelShort')}</button>
                <button type="submit" disabled={creating} className="gradient-btn flex-1 disabled:opacity-50">
                  {creating ? t('common.saving') : t('appointments.schedule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
