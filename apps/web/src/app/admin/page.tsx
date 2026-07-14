'use client';



import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import Link from 'next/link';

import { Stethoscope, Users, Building2, Activity, LogOut, Shield, FileText, UserPlus, X } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { api, User, DashboardStats, Facility } from '@/lib/api';
import { canAccessAdmin } from '@ishifo/shared';
import { UserRole } from '@ishifo/shared';
import { getRoleHomePath, getRoleLabel } from '@/lib/auth-utils';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';



export default function AdminPage() {

  const { user, loading, logout } = useAuth();

  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);

  const [facilities, setFacilities] = useState<Facility[]>([]);

  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [error, setError] = useState('');

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);

  const [creating, setCreating] = useState(false);

  const [showFacilityForm, setShowFacilityForm] = useState(false);

  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);

  const [facilityForm, setFacilityForm] = useState({ name: '', code: '', type: 'UT', address: '', region: '', district: '', phone: '' });

  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [editUserForm, setEditUserForm] = useState({ fullName: '', role: '', facilityId: '', password: '' });

  const [savingUser, setSavingUser] = useState(false);

  const [savingFacility, setSavingFacility] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [form, setForm] = useState({

    email: '',

    password: '',

    fullName: '',

    role: UserRole.UT_OPERATOR as string,

    facilityId: '',

  });



  useEffect(() => {

    if (loading) return;

    if (!user) {

      router.replace('/login');

      return;

    }

    if (!canAccessAdmin(user.role)) router.replace(getRoleHomePath(user.role));

  }, [user, loading, router]);



  useEffect(() => {

    if (loading || !user || !canAccessAdmin(user.role)) return;

    load();

  }, [user, loading]);



  const load = () => {
    setError('');
    setDataLoading(true);
    Promise.all([api.getUsers(), api.getStats(), api.getFacilities()])
      .then(([u, s, f]) => { setUsers(u); setStats(s); setFacilities(f); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik yuz berdi'))
      .finally(() => setDataLoading(false));
  };



  const handleToggle = async (id: string) => {

    if (id === user?.id) return;

    setTogglingId(id);

    try {

      await api.toggleUserActive(id);

      load();

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');

    } finally {

      setTogglingId(null);

    }

  };



  const handleCreate = async (e: React.FormEvent) => {

    e.preventDefault();

    setCreating(true);

    setError('');

    try {

      await api.createUser({

        email: form.email,

        password: form.password,

        fullName: form.fullName,

        role: form.role,

        facilityId: form.facilityId || undefined,

      });

      setShowCreate(false);

      setForm({ email: '', password: '', fullName: '', role: UserRole.UT_OPERATOR, facilityId: '' });

      load();

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');

    } finally {

      setCreating(false);

    }

  };



  const openEditUser = (u: User) => {

    setEditingUser(u);

    setEditUserForm({ fullName: u.fullName, role: u.role, facilityId: u.facility?.id || '', password: '' });

  };



  const handleSaveUser = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!editingUser) return;

    setSavingUser(true);

    setError('');

    try {

      await api.updateUser(editingUser.id, {

        fullName: editUserForm.fullName,

        role: editUserForm.role,

        facilityId: editUserForm.facilityId || null,

      });

      if (editUserForm.password.length >= 8) {

        await api.resetUserPassword(editingUser.id, editUserForm.password);

      }

      setEditingUser(null);

      load();

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');

    } finally {

      setSavingUser(false);

    }

  };



  const openFacilityForm = (f?: Facility) => {

    if (f) {

      setEditingFacility(f);

      setFacilityForm({ name: f.name, code: f.code, type: f.type, address: '', region: '', district: '', phone: '' });

    } else {

      setEditingFacility(null);

      setFacilityForm({ name: '', code: '', type: 'UT', address: '', region: '', district: '', phone: '' });

    }

    setShowFacilityForm(true);

  };



  const handleSaveFacility = async (e: React.FormEvent) => {

    e.preventDefault();

    setSavingFacility(true);

    setError('');

    try {

      if (editingFacility) {

        await api.updateFacility(editingFacility.id, {

          name: facilityForm.name,

          code: facilityForm.code,

          type: facilityForm.type,

          ...(facilityForm.address && { address: facilityForm.address }),

        });

      } else {

        await api.createFacility({

          name: facilityForm.name,

          code: facilityForm.code,

          type: facilityForm.type,

          address: facilityForm.address || '—',

          region: facilityForm.region || undefined,

          district: facilityForm.district || undefined,

          phone: facilityForm.phone || undefined,

        });

      }

      setShowFacilityForm(false);

      setEditingFacility(null);

      load();

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');

    } finally {

      setSavingFacility(false);

    }

  };



  if (loading || !user || !canAccessAdmin(user.role)) return null;



  const facilityTypeLabels: Record<string, string> = {
    UT: 'Uzoq muassasa (UT)',
    MT: 'Markaziy tibbiyot (MT)',
  };



  return (

    <div className="min-h-screen bg-surface">

      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80">

        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-xl gradient-btn flex items-center justify-center">

              <Shield className="w-5 h-5 text-white" />

            </div>

            <div>

              <h1 className="font-bold text-slate-900 tracking-tight"><BrandName size="sm" /> — Admin Panel</h1>

              <p className="text-xs text-slate-500">Tizim boshqaruvi</p>

            </div>

          </div>

          <div className="flex items-center gap-3">

            <Link href="/admin/audit" className="btn-secondary !py-2 !text-xs hidden sm:inline-flex">

              <FileText size={14} /> Audit jurnali

            </Link>

            <button onClick={logout} className="btn-ghost text-red-500 hover:text-red-600 hover:bg-red-50">

              <LogOut size={16} /> Chiqish

            </button>

          </div>

        </div>

      </header>



      <main className="max-w-6xl mx-auto p-6 animate-fade-in">

        {error && (

          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5">{error}</div>

        )}



        {dataLoading && (
          <div className="text-sm text-slate-500 animate-pulse mb-4">Ma&apos;lumotlar yuklanmoqda...</div>
        )}

        {stats && (

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

            <StatCard icon={Activity} label="Jami konsultatsiyalar" value={stats.totalConsultations} bg="bg-brand-50" text="text-brand-600" />

            <StatCard icon={Users} label="Bemorlar" value={stats.totalPatients} bg="bg-cyan-50" text="text-cyan-600" />

            <StatCard icon={Building2} label="Jarayonda" value={stats.inProgress} bg="bg-emerald-50" text="text-emerald-600" />

            <StatCard icon={Stethoscope} label="Navbatda" value={stats.queued} bg="bg-amber-50" text="text-amber-600" />

          </div>

        )}



        <div className="panel overflow-hidden animate-slide-up">

          <div className="panel-header bg-gradient-to-r from-slate-50 to-transparent">

            <Users size={18} className="text-brand-600" />

            <span className="panel-title">Foydalanuvchilar ({users.length})</span>

            <button

              type="button"

              onClick={() => setShowCreate(true)}

              className="ml-auto btn-primary !py-1.5 !text-xs"

            >

              <UserPlus size={14} /> Yangi foydalanuvchi

            </button>

          </div>

          <div className="overflow-x-auto">

            <table className="data-table">

              <thead>

                <tr>

                  <th>F.I.Sh.</th>

                  <th>Email</th>

                  <th>Rol</th>

                  <th>Muassasa</th>

                  <th>Holat</th>

                  <th className="text-right">Amal</th>

                </tr>

              </thead>

              <tbody>

                {users.map((u) => (

                  <tr key={u.id}>

                    <td className="font-semibold text-slate-800">{u.fullName}</td>

                    <td className="text-slate-500">{u.email}</td>

                    <td>

                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">

                        {getRoleLabel(u.role)}

                      </span>

                    </td>

                    <td className="text-slate-500">{u.facility?.name || '—'}</td>

                    <td>

                      <span className={`status-badge ${u.isActive !== false ? 'status-in-progress' : 'bg-red-50 text-red-700 ring-red-200/60'}`}>

                        {u.isActive !== false ? 'Faol' : 'Bloklangan'}

                      </span>

                    </td>

                    <td className="text-right">

                      <div className="flex items-center justify-end gap-2">

                        <button type="button" onClick={() => openEditUser(u)} className="text-xs font-medium text-brand-600 hover:bg-brand-50 px-2 py-1.5 rounded-lg">

                          Tahrirlash

                        </button>

                        {u.id !== user.id && (

                          <button

                            type="button"

                            disabled={togglingId === u.id}

                            onClick={() => handleToggle(u.id)}

                            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${

                              u.isActive !== false

                                ? 'text-red-600 hover:bg-red-50'

                                : 'text-emerald-600 hover:bg-emerald-50'

                            }`}

                          >

                            {togglingId === u.id ? '...' : u.isActive !== false ? 'Bloklash' : 'Faollashtirish'}

                          </button>

                        )}

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>



        <div className="panel overflow-hidden animate-slide-up mt-8">

          <div className="panel-header bg-gradient-to-r from-slate-50 to-transparent">

            <Building2 size={18} className="text-brand-600" />

            <span className="panel-title">Muassasalar ({facilities.length})</span>

            <button type="button" onClick={() => openFacilityForm()} className="ml-auto btn-primary !py-1.5 !text-xs">

              Yangi muassasa

            </button>

          </div>

          <div className="overflow-x-auto">

            <table className="data-table">

              <thead>

                <tr>

                  <th>Nomi</th>

                  <th>Kod</th>

                  <th>Turi</th>

                  <th className="text-right">Amal</th>

                </tr>

              </thead>

              <tbody>

                {facilities.map((f) => (

                  <tr key={f.id}>

                    <td className="font-semibold text-slate-800">{f.name}</td>

                    <td className="text-slate-500">{f.code}</td>

                    <td>{facilityTypeLabels[f.type] || f.type}</td>

                    <td className="text-right">

                      <button type="button" onClick={() => openFacilityForm(f)} className="text-xs font-medium text-brand-600 hover:bg-brand-50 px-2 py-1.5 rounded-lg">

                        Tahrirlash

                      </button>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

      </main>



      {showCreate && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">

          <div className="panel p-6 w-full max-w-md animate-slide-up">

            <div className="flex items-center justify-between mb-5">

              <h2 className="font-bold text-slate-900">Yangi foydalanuvchi</h2>

              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">

                <X size={20} />

              </button>

            </div>

            <form onSubmit={handleCreate} className="space-y-4">

              <div>

                <label className="label">F.I.Sh.</label>

                <input className="form-input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />

              </div>

              <div>

                <label className="label">Email</label>

                <input type="email" className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

              </div>

              <div>

                <label className="label">Parol (min 8 belgi)</label>

                <input type="password" className="form-input" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

              </div>

              <div>

                <label className="label">Rol</label>

                <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                  <option value={UserRole.UT_OPERATOR}>UT Operator</option>
                  <option value={UserRole.MT_DOCTOR}>MT Shifokor</option>
                  <option value={UserRole.MT_MANAGER}>MT Manager</option>
                  <option value={UserRole.ADMIN}>Administrator</option>
                  <option value={UserRole.AUDITOR}>Auditor</option>
                </select>

              </div>

              <div>

                <label className="label">Muassasa</label>

                <select className="form-input" value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>

                  <option value="">— Tanlanmagan —</option>

                  {facilities.map((f) => (

                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>

                  ))}

                </select>

              </div>

              <div className="flex gap-3 pt-2">

                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Bekor</button>

                <button type="submit" disabled={creating} className="gradient-btn flex-1 disabled:opacity-50">

                  {creating ? 'Yaratilmoqda...' : 'Yaratish'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="panel p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-900">Foydalanuvchini tahrirlash</h2>
              <button type="button" onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="label">F.I.Sh.</label>
                <input className="form-input" required value={editUserForm.fullName} onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })} />
              </div>
              <div>
                <label className="label">Rol</label>
                <select className="form-input" value={editUserForm.role} onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}>
                  <option value={UserRole.UT_OPERATOR}>UT Operator</option>
                  <option value={UserRole.MT_DOCTOR}>MT Shifokor</option>
                  <option value={UserRole.MT_MANAGER}>MT Manager</option>
                  <option value={UserRole.ADMIN}>Administrator</option>
                  <option value={UserRole.AUDITOR}>Auditor</option>
                </select>
              </div>
              <div>
                <label className="label">Muassasa</label>
                <select className="form-input" value={editUserForm.facilityId} onChange={(e) => setEditUserForm({ ...editUserForm, facilityId: e.target.value })}>
                  <option value="">— Tanlanmagan —</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Yangi parol (ixtiyoriy, min 8)</label>
                <input type="password" className="form-input" minLength={8} value={editUserForm.password} onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary flex-1">Bekor</button>
                <button type="submit" disabled={savingUser} className="gradient-btn flex-1 disabled:opacity-50">
                  {savingUser ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFacilityForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="panel p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-900">{editingFacility ? 'Muassasani tahrirlash' : 'Yangi muassasa'}</h2>
              <button type="button" onClick={() => setShowFacilityForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveFacility} className="space-y-4">
              <div>
                <label className="label">Nomi</label>
                <input className="form-input" required value={facilityForm.name} onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Kod</label>
                <input className="form-input" required value={facilityForm.code} onChange={(e) => setFacilityForm({ ...facilityForm, code: e.target.value })} />
              </div>
              <div>
                <label className="label">Turi</label>
                <select className="form-input" value={facilityForm.type} onChange={(e) => setFacilityForm({ ...facilityForm, type: e.target.value })}>
                  <option value="UT">UT</option>
                  <option value="MT">MT</option>
                </select>
              </div>
              {!editingFacility && (
                <div>
                  <label className="label">Manzil</label>
                  <input className="form-input" required value={facilityForm.address} onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })} />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowFacilityForm(false)} className="btn-secondary flex-1">Bekor</button>
                <button type="submit" disabled={savingFacility} className="gradient-btn flex-1 disabled:opacity-50">
                  {savingFacility ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 pb-8 mt-8">
        <PlatformFooter variant="compact" />
      </div>

    </div>

  );

}



function StatCard({ icon: Icon, label, value, bg, text }: {

  icon: React.ElementType; label: string; value: number; bg: string; text: string;

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


