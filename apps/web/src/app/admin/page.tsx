'use client';



import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import Link from 'next/link';

import { Stethoscope, Users, Building2, Activity, LogOut, Shield, FileText, UserPlus, X, GraduationCap, BarChart3 } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { api, User, DashboardStats, Facility, Specialty, AdminOverview } from '@/lib/api';
import { canAccessAdmin } from '@ishifo/shared';
import { UserRole } from '@ishifo/shared';
import { getRoleHomePath, getRoleLabel } from '@/lib/auth-utils';
import { BrandName } from '@/components/brand/BrandName';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import { AdminSpecialtiesPanel } from '@/components/admin/AdminSpecialtiesPanel';
import { AdminOverviewPanel } from '@/components/admin/AdminOverviewPanel';



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

  const [savingUser, setSavingUser] = useState(false);

  const [savingFacility, setSavingFacility] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'specialties' | 'facilities' | 'stats'>('users');
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const [form, setForm] = useState({

    email: '',

    password: '',

    fullName: '',

    role: UserRole.UT_OPERATOR as string,

    facilityId: '',

    specialtyId: '',

    phone: '',

  });

  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    role: '',
    facilityId: '',
    specialtyId: '',
    phone: '',
    password: '',
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
    Promise.all([
      api.getUsers(),
      api.getStats(),
      api.getFacilities(),
      api.getSpecialties(true),
      api.getAdminOverview(),
    ])
      .then(([u, s, f, sp, ov]) => {
        setUsers(u);
        setStats(s);
        setFacilities(f);
        setSpecialties(sp);
        setOverview(ov);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik yuz berdi'))
      .finally(() => setDataLoading(false));
  };

  const loadOverview = () => {
    setOverviewLoading(true);
    api.getAdminOverview()
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : 'Statistika yuklanmadi'))
      .finally(() => setOverviewLoading(false));
  };

  const facilitiesForRole = (role: string) => {
    if (role === UserRole.UT_OPERATOR) return facilities.filter((f) => f.type === 'UT');
    if (role === UserRole.MT_DOCTOR || role === UserRole.MT_MANAGER) return facilities.filter((f) => f.type === 'MT');
    return facilities;
  };

  const isMtRole = (role: string) => role === UserRole.MT_DOCTOR || role === UserRole.MT_MANAGER;

  const filteredUsers = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter);



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

        specialtyId: isMtRole(form.role) && form.specialtyId ? form.specialtyId : undefined,

        phone: form.phone || undefined,

      });

      setShowCreate(false);

      setForm({ email: '', password: '', fullName: '', role: UserRole.UT_OPERATOR, facilityId: '', specialtyId: '', phone: '' });

      load();

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');

    } finally {

      setCreating(false);

    }

  };



  const openEditUser = (u: User) => {

    setEditingUser(u);

    setEditUserForm({
      fullName: u.fullName,
      role: u.role,
      facilityId: u.facility?.id || '',
      specialtyId: u.specialtyId || u.specialtyRef?.id || '',
      phone: u.phone || '',
      password: '',
    });

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

        specialtyId: isMtRole(editUserForm.role) ? (editUserForm.specialtyId || null) : null,

        phone: editUserForm.phone || null,

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

        {stats && activeTab === 'users' && (

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

            <StatCard icon={Activity} label="Jami konsultatsiyalar" value={stats.totalConsultations} bg="bg-brand-50" text="text-brand-600" />

            <StatCard icon={Users} label="Bemorlar" value={stats.totalPatients} bg="bg-cyan-50" text="text-cyan-600" />

            <StatCard icon={Building2} label="Jarayonda" value={stats.inProgress} bg="bg-emerald-50" text="text-emerald-600" />

            <StatCard icon={Stethoscope} label="Navbatda" value={stats.queued} bg="bg-amber-50" text="text-amber-600" />

          </div>

        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {([
            ['users', 'Foydalanuvchilar', Users],
            ['specialties', 'Yo\'nalishlar', GraduationCap],
            ['facilities', 'Muassasalar', Building2],
            ['stats', 'Statistika', BarChart3],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                if (id === 'stats') loadOverview();
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'users' && (
        <div className="panel overflow-hidden animate-slide-up">

          <div className="panel-header bg-gradient-to-r from-slate-50 to-transparent">

            <Users size={18} className="text-brand-600" />

            <span className="panel-title">Foydalanuvchilar ({filteredUsers.length})</span>

            <select
              className="form-input !py-1 !text-xs !w-auto ml-2"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">Barcha rollar</option>
              <option value={UserRole.UT_OPERATOR}>UT Operator</option>
              <option value={UserRole.MT_DOCTOR}>MT Shifokor</option>
              <option value={UserRole.MT_MANAGER}>MT Manager</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>

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

                  <th>Yo&apos;nalish</th>

                  <th>Muassasa</th>

                  <th>Telefon</th>

                  <th>Holat</th>

                  <th className="text-right">Amal</th>

                </tr>

              </thead>

              <tbody>

                {filteredUsers.map((u) => (

                  <tr key={u.id}>

                    <td className="font-semibold text-slate-800">{u.fullName}</td>

                    <td className="text-slate-500">{u.email}</td>

                    <td>

                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">

                        {getRoleLabel(u.role)}

                      </span>

                    </td>

                    <td className="text-slate-500">{u.specialtyRef?.name || u.specialty || '—'}</td>

                    <td className="text-slate-500">{u.facility?.name || '—'}</td>

                    <td className="text-slate-500">{u.phone || '—'}</td>

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
        )}

        {activeTab === 'specialties' && (
          <AdminSpecialtiesPanel
            specialties={specialties}
            onRefresh={() => {
              api.getSpecialties(true).then(setSpecialties).catch(() => {});
              loadOverview();
            }}
            onError={setError}
          />
        )}

        {activeTab === 'facilities' && (
        <div className="panel overflow-hidden animate-slide-up">

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
        )}

        {activeTab === 'stats' && (
          <AdminOverviewPanel overview={overview} loading={overviewLoading || dataLoading} />
        )}

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

                <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole, facilityId: '', specialtyId: '' })}>
                  <option value={UserRole.UT_OPERATOR}>UT Operator</option>
                  <option value={UserRole.MT_DOCTOR}>MT Shifokor</option>
                  <option value={UserRole.MT_MANAGER}>MT Manager</option>
                  <option value={UserRole.ADMIN}>Administrator</option>
                  <option value={UserRole.AUDITOR}>Auditor</option>
                </select>

              </div>

              {isMtRole(form.role) && (
                <div>
                  <label className="label">Yo&apos;nalish</label>
                  <select className="form-input" value={form.specialtyId} onChange={(e) => setForm({ ...form, specialtyId: e.target.value })}>
                    <option value="">— Tanlanmagan —</option>
                    {specialties.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>

                <label className="label">Muassasa {form.role !== UserRole.ADMIN && form.role !== UserRole.AUDITOR ? '*' : ''}</label>

                <select className="form-input" value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })} required={form.role !== UserRole.ADMIN && form.role !== UserRole.AUDITOR}>

                  <option value="">— Tanlanmagan —</option>

                  {facilitiesForRole(form.role).map((f) => (

                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>

                  ))}

                </select>

              </div>

              <div>
                <label className="label">Telefon</label>
                <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 123 45 67" />
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
                <select className="form-input" value={editUserForm.role} onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value, facilityId: '', specialtyId: '' })}>
                  <option value={UserRole.UT_OPERATOR}>UT Operator</option>
                  <option value={UserRole.MT_DOCTOR}>MT Shifokor</option>
                  <option value={UserRole.MT_MANAGER}>MT Manager</option>
                  <option value={UserRole.ADMIN}>Administrator</option>
                  <option value={UserRole.AUDITOR}>Auditor</option>
                </select>
              </div>
              {isMtRole(editUserForm.role) && (
                <div>
                  <label className="label">Yo&apos;nalish</label>
                  <select className="form-input" value={editUserForm.specialtyId} onChange={(e) => setEditUserForm({ ...editUserForm, specialtyId: e.target.value })}>
                    <option value="">— Tanlanmagan —</option>
                    {specialties.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Muassasa</label>
                <select className="form-input" value={editUserForm.facilityId} onChange={(e) => setEditUserForm({ ...editUserForm, facilityId: e.target.value })}>
                  <option value="">— Tanlanmagan —</option>
                  {facilitiesForRole(editUserForm.role).map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Telefon</label>
                <input className="form-input" value={editUserForm.phone} onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })} />
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


