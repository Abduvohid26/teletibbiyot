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

export default function AppointmentsPage() {
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
      .catch((e) => toast(e instanceof Error ? e.message : 'Xatolik', 'error'))
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
    const t = setTimeout(() => {
      api.getPatients({ search: patientSearch, limit: 8 })
        .then((r) => setPatients(r.items))
        .catch(() => setPatients([]));
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.updateAppointmentStatus(id, status);
      toast('Holat yangilandi', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Xatolik', 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId || !form.facilityId || !form.scheduledAt) {
      toast('Bemor, muassasa va sana majburiy', 'error');
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
      toast('Uchrashuv rejalashtirildi', 'success');
      setShowCreate(false);
      setForm({ patientId: '', facilityId: '', doctorId: '', scheduledAt: '', notes: '' });
      setPatientSearch('');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Xatolik', 'error');
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <DashboardLayout
      title="Uchrashuvlar"
      subtitle="Rejalashtirilgan qayta ko'riklar"
      actions={
        canCreate ? (
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary !text-xs">
            <Plus size={14} /> Yangi uchrashuv
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {loading && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}
        {!loading && items.length === 0 && (
          <div className="panel p-10 text-center text-slate-500">
            <Calendar className="mx-auto mb-3 opacity-40" size={32} />
            <p>14 kun ichida uchrashuv yo&apos;q</p>
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
                  {new Date(a.scheduledAt).toLocaleString('uz-UZ')}
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
                  <CheckCircle2 size={14} /> Bajarildi
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(a.id, 'CANCELLED')}
                  className="text-xs text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg inline-flex items-center gap-1"
                >
                  <XCircle size={14} /> Bekor
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
              <h2 className="font-bold text-slate-900">Yangi uchrashuv</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="label">Bemor qidirish</label>
                <input
                  className="form-input"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Ism, telefon, PINFL..."
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
                <label className="label">Muassasa</label>
                <select className="form-input" required value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>
                  <option value="">Tanlang</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Shifokor (ixtiyoriy)</label>
                <select className="form-input" value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                  <option value="">Tanlanmagan</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sana va vaqt</label>
                <input type="datetime-local" className="form-input" required value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
              </div>
              <div>
                <label className="label">Izoh</label>
                <textarea className="form-input min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Bekor</button>
                <button type="submit" disabled={creating} className="gradient-btn flex-1 disabled:opacity-50">
                  {creating ? 'Saqlanmoqda...' : 'Rejalashtirish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
