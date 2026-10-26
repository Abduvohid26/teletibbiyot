'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Building2, LogOut, FileText, UserPlus, X, GraduationCap, BarChart3, MonitorDot } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, User, Facility, Specialty, AdminOverview } from '@/lib/api';
import { canAccessAdmin } from '@ishifo/shared';
import { UserRole } from '@ishifo/shared';
import { getRoleHomePath } from '@/lib/auth-utils';
import { BrandName } from '@/components/brand/BrandName';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AdminLivePanel } from '@/components/admin/AdminLivePanel';
import { PlatformFooter } from '@/components/layout/PlatformFooter';
import { AdminSpecialtiesPanel } from '@/components/admin/AdminSpecialtiesPanel';
import { AdminOverviewPanel } from '@/components/admin/AdminOverviewPanel';
import { LanguageSwitcher, useI18n } from '@/i18n';

function roleKey(role: string): string {
  if (role === UserRole.UT_OPERATOR) return 'roles.utOperator';
  if (role === UserRole.MT_DOCTOR) return 'roles.mtDoctor';
  if (role === UserRole.ADMIN) return 'roles.admin';
  return role;
}

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
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
  const [activeTab, setActiveTab] = useState<'monitor' | 'users' | 'specialties' | 'facilities' | 'stats'>('monitor');
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
    loadOverview();
  }, [user, loading]);

  const load = () => {
    setError('');
    setDataLoading(true);
    Promise.allSettled([
      api.getUsers(),
      api.getFacilities(),
      api.getSpecialties(true),
    ])
      .then((results) => {
        const [usersR, facilitiesR, specialtiesR] = results;
        if (usersR.status === 'fulfilled') setUsers(usersR.value);
        if (facilitiesR.status === 'fulfilled') setFacilities(facilitiesR.value);
        if (specialtiesR.status === 'fulfilled') setSpecialties(specialtiesR.value);

        if (usersR.status === 'rejected') {
          const err = usersR.reason;
          setError(err instanceof Error ? err.message : t('admin.usersLoadFailed'));
        }
      })
      .finally(() => setDataLoading(false));
  };

  const loadOverview = () => {
    setOverviewLoading(true);
    api.getAdminOverview()
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setOverviewLoading(false));
  };

  const facilitiesForRole = (role: string) => {
    if (role === UserRole.UT_OPERATOR) return facilities.filter((f) => f.type === 'UT');
    if (role === UserRole.MT_DOCTOR) return facilities.filter((f) => f.type === 'MT');
    return facilities;
  };

  const isMtRole = (role: string) => role === UserRole.MT_DOCTOR;

  const filteredUsers = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter);
  // UT operator / shifokor uchun mos turdagi muassasa bo'lmasa, forma yuborilmaydi —
  // sababini ko'rsatib, muassasalar bo'limiga yo'naltiramiz
  const needsFacility = form.role !== UserRole.ADMIN;
  const noFacilityForRole = needsFacility && facilitiesForRole(form.role).length === 0;

  const handleToggle = async (id: string) => {
    if (id === user?.id) return;
    setTogglingId(id);
    try {
      await api.toggleUserActive(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
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
      setError(err instanceof Error ? err.message : t('errors.generic'));
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
      setError(err instanceof Error ? err.message : t('errors.generic'));
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
          address: facilityForm.address || t('common.emptyDash'),
          region: facilityForm.region || undefined,
          district: facilityForm.district || undefined,
          phone: facilityForm.phone || undefined,
        });
      }
      setShowFacilityForm(false);
      setEditingFacility(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setSavingFacility(false);
    }
  };

  if (loading || !user || !canAccessAdmin(user.role)) return null;

  const facilityTypeLabels: Record<string, string> = {
    UT: t('admin.facilityTypeUt'),
    MT: t('admin.facilityTypeMt'),
  };

  const tabs = [
    ['monitor', 'adminLive.tab', MonitorDot],
    ['users', 'admin.tabUsers', Users],
    ['specialties', 'admin.tabSpecialties', GraduationCap],
    ['facilities', 'admin.tabFacilities', Building2],
    ['stats', 'admin.tabStats', BarChart3],
  ] as const;

  return (
    <div className="min-h-screen bg-[#f2f4f8]">
      <header className="sticky top-0 z-20 border-b border-gold-400/25 bg-brand-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandLogo size={32} className="rounded-lg ring-1 ring-white/15" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold"><BrandName size="sm" /> · {t('admin.title')}</p>
              <p className="hidden truncate text-xs text-gold-300/90 sm:block">{user.fullName}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher compact tone="dark" className="hidden sm:inline-flex" />
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg p-2 text-sm text-slate-300 hover:bg-white/10 hover:text-rose-300"
              aria-label={t('common.logout')}
            >
              <LogOut size={16} /> <span className="hidden md:inline">{t('common.logout')}</span>
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 ut-nav-scroll sm:px-6" aria-label={t('admin.title')}>
          {tabs.map(([id, labelKey, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                if (id === 'stats') loadOverview();
              }}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeTab === id ? 'bg-white text-brand-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={15} className={activeTab === id ? 'text-gold-600' : undefined} />
              {t(labelKey)}
            </button>
          ))}
          <Link
            href="/admin/audit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <FileText size={15} /> {t('admin.auditLog')}
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl p-4 animate-fade-in sm:p-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>
        )}

        {dataLoading && activeTab !== 'monitor' && (
          <div className="mb-4 animate-pulse text-sm text-slate-500">{t('admin.loadingData')}</div>
        )}

        {activeTab === 'monitor' && <AdminLivePanel />}

        {activeTab === 'users' && (
        <div className="panel overflow-hidden animate-slide-up">
          <div className="panel-header bg-gradient-to-r from-slate-50 to-transparent">
            <Users size={18} className="text-brand-600" />
            <span className="panel-title">{t('admin.usersTitle', { count: filteredUsers.length })}</span>
            <select
              className="form-input !py-1 !text-xs !w-auto ml-2"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">{t('admin.allRoles')}</option>
              <option value={UserRole.UT_OPERATOR}>{t('roles.utOperator')}</option>
              <option value={UserRole.MT_DOCTOR}>{t('roles.mtDoctor')}</option>
              <option value={UserRole.ADMIN}>{t('roles.adminShort')}</option>
            </select>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="ml-auto btn-primary !py-1.5 !text-xs"
            >
              <UserPlus size={14} /> {t('admin.newUser')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('admin.fullName')}</th>
                  <th>{t('login.email')}</th>
                  <th>{t('admin.role')}</th>
                  <th>{t('admin.specialty')}</th>
                  <th>{t('admin.facility')}</th>
                  <th>{t('admin.phone')}</th>
                  <th>{t('common.status')}</th>
                  <th className="text-right">{t('admin.action')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold text-slate-800">{u.fullName}</td>
                    <td className="text-slate-500">{u.email}</td>
                    <td>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        {t(roleKey(u.role))}
                      </span>
                    </td>
                    <td className="text-slate-500">{u.specialtyRef?.name || u.specialty || t('common.emptyDash')}</td>
                    <td className="text-slate-500">{u.facility?.name || t('common.emptyDash')}</td>
                    <td className="text-slate-500">{u.phone || t('common.emptyDash')}</td>
                    <td>
                      <span className={`status-badge ${u.isActive !== false ? 'status-in-progress' : 'bg-red-50 text-red-700 ring-red-200/60'}`}>
                        {u.isActive !== false ? t('common.active') : t('admin.blocked')}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => openEditUser(u)} className="text-xs font-medium text-brand-600 hover:bg-brand-50 px-2 py-1.5 rounded-lg">
                          {t('common.edit')}
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
                            {togglingId === u.id ? '...' : u.isActive !== false ? t('admin.block') : t('admin.activate')}
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
            <span className="panel-title">{t('admin.facilitiesTitle', { count: facilities.length })}</span>
            <button type="button" onClick={() => openFacilityForm()} className="ml-auto btn-primary !py-1.5 !text-xs">
              {t('admin.newFacility')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('admin.name')}</th>
                  <th>{t('admin.code')}</th>
                  <th>{t('admin.type')}</th>
                  <th className="text-right">{t('admin.action')}</th>
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
                        {t('common.edit')}
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
          <AdminOverviewPanel overview={overview} loading={overviewLoading} onRetry={loadOverview} />
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="panel p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-900">{t('admin.newUser')}</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">{t('admin.fullName')}</label>
                <input className="form-input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('login.email')}</label>
                <input type="email" className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.passwordMin')}</label>
                <input type="password" className="form-input" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.role')}</label>
                <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole, facilityId: '', specialtyId: '' })}>
                  <option value={UserRole.UT_OPERATOR}>{t('roles.utOperator')}</option>
                  <option value={UserRole.MT_DOCTOR}>{t('roles.mtDoctor')}</option>
                  <option value={UserRole.ADMIN}>{t('roles.admin')}</option>
                </select>
              </div>
              {isMtRole(form.role) && (
                <div>
                  <label className="label">{t('admin.specialty')}</label>
                  <select className="form-input" value={form.specialtyId} onChange={(e) => setForm({ ...form, specialtyId: e.target.value })}>
                    <option value="">{t('admin.notSelectedOption')}</option>
                    {specialties.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">{t('admin.facility')} {form.role !== UserRole.ADMIN ? '*' : ''}</label>
                <select className="form-input" value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })} required={form.role !== UserRole.ADMIN}>
                  <option value="">{t('admin.notSelectedOption')}</option>
                  {facilitiesForRole(form.role).map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
                {needsFacility && noFacilityForRole && (
                  <p className="mt-1.5 text-xs text-amber-700">
                    {form.role === UserRole.UT_OPERATOR
                      ? t('admin.noUtFacilityHint')
                      : t('admin.noMtFacilityHint')}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreate(false);
                        setActiveTab('facilities');
                      }}
                      className="font-semibold underline"
                    >
                      {t('admin.goToFacilities')}
                    </button>
                  </p>
                )}
              </div>
              <div>
                <label className="label">{t('admin.phone')}</label>
                <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 123 45 67" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">{t('common.cancelShort')}</button>
                <button
                  type="submit"
                  disabled={creating || (needsFacility && noFacilityForRole)}
                  className="gradient-btn flex-1 disabled:opacity-50"
                >
                  {creating ? t('admin.creating') : t('admin.create')}
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
              <h2 className="font-bold text-slate-900">{t('admin.editUser')}</h2>
              <button type="button" onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="label">{t('admin.fullName')}</label>
                <input className="form-input" required value={editUserForm.fullName} onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.role')}</label>
                <select className="form-input" value={editUserForm.role} onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value, facilityId: '', specialtyId: '' })}>
                  <option value={UserRole.UT_OPERATOR}>{t('roles.utOperator')}</option>
                  <option value={UserRole.MT_DOCTOR}>{t('roles.mtDoctor')}</option>
                  <option value={UserRole.ADMIN}>{t('roles.admin')}</option>
                </select>
              </div>
              {isMtRole(editUserForm.role) && (
                <div>
                  <label className="label">{t('admin.specialty')}</label>
                  <select className="form-input" value={editUserForm.specialtyId} onChange={(e) => setEditUserForm({ ...editUserForm, specialtyId: e.target.value })}>
                    <option value="">{t('admin.notSelectedOption')}</option>
                    {specialties.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">{t('admin.facility')}</label>
                <select className="form-input" value={editUserForm.facilityId} onChange={(e) => setEditUserForm({ ...editUserForm, facilityId: e.target.value })}>
                  <option value="">{t('admin.notSelectedOption')}</option>
                  {facilitiesForRole(editUserForm.role).map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('admin.phone')}</label>
                <input className="form-input" value={editUserForm.phone} onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.passwordOptional')}</label>
                <input type="password" className="form-input" minLength={8} value={editUserForm.password} onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary flex-1">{t('common.cancelShort')}</button>
                <button type="submit" disabled={savingUser} className="gradient-btn flex-1 disabled:opacity-50">
                  {savingUser ? t('common.saving') : t('common.save')}
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
              <h2 className="font-bold text-slate-900">{editingFacility ? t('admin.editFacility') : t('admin.newFacility')}</h2>
              <button type="button" onClick={() => setShowFacilityForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveFacility} className="space-y-4">
              <div>
                <label className="label">{t('admin.name')}</label>
                <input className="form-input" required value={facilityForm.name} onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.code')}</label>
                <input className="form-input" required value={facilityForm.code} onChange={(e) => setFacilityForm({ ...facilityForm, code: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('admin.type')}</label>
                <select className="form-input" value={facilityForm.type} onChange={(e) => setFacilityForm({ ...facilityForm, type: e.target.value })}>
                  <option value="UT">UT</option>
                  <option value="MT">MT</option>
                </select>
              </div>
              {!editingFacility && (
                <div>
                  <label className="label">{t('admin.address')}</label>
                  <input className="form-input" required value={facilityForm.address} onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })} />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowFacilityForm(false)} className="btn-secondary flex-1">{t('common.cancelShort')}</button>
                <button type="submit" disabled={savingFacility} className="gradient-btn flex-1 disabled:opacity-50">
                  {savingFacility ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 pb-8 mt-8">
        <PlatformFooter variant="compact" />
      </div>
    </div>
  );
}
