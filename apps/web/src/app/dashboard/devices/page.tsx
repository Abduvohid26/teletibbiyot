'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api, DeviceStatus, Facility } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { CheckCircle2, XCircle, RefreshCw, Cpu } from 'lucide-react';
import { ROLES_MT_DASHBOARD, ROLES_UT } from '@/lib/roles';
import { isUtRole } from '@ishifo/shared';
import { useI18n } from '@/i18n';
import { LocalDevicesPanel } from '@/components/devices/LocalDevicesPanel';

export default function DevicesPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useRequireAuth([...ROLES_MT_DASHBOARD, ...ROLES_UT]);
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [facilityLabel, setFacilityLabel] = useState('');

  const canEdit = isUtRole(user?.role || '');

  const loadDevices = async (facilityId: string, facilityName?: string) => {
    if (!facilityId) {
      setDevices([]);
      setFacilityLabel('');
      return;
    }
    setFacilityLabel(facilityName || facilityId);
    setDevices(await api.getDevices(facilityId));
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const facs = facilities.length ? facilities : await api.getFacilities();
      if (!facilities.length) setFacilities(facs);
      const facilityId = selectedFacilityId || facs[0]?.id;
      if (facilityId && !selectedFacilityId) setSelectedFacilityId(facilityId);
      const fac = facs.find((f) => f.id === facilityId);
      await loadDevices(facilityId || '', fac?.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) load();
  }, [user, authLoading, selectedFacilityId]);

  useConsultationRealtime([], {
    onDeviceStatusUpdated: (facilityId) => {
      if (!selectedFacilityId || facilityId === selectedFacilityId) void load();
    },
  }, { staffFeed: true });

  const toggleDevice = async (device: DeviceStatus) => {
    if (!canEdit) return;
    setUpdatingId(device.id);
    try {
      const connected = !device.connected;
      await api.updateDevice(device.id, connected, connected ? 'ONLINE' : 'OFFLINE');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('devices.updateError'));
    } finally {
      setUpdatingId(null);
    }
  };

  if (authLoading || !user) return null;

  const showFacilityPicker = !isUtRole(user.role);

  return (
    <DashboardLayout
      title={t('devices.title')}
      subtitle={facilityLabel ? `${facilityLabel}` : t('devices.noFacility')}
      actions={
        <div className="flex items-center gap-2">
          {showFacilityPicker && facilities.length > 0 && (
            <select
              className="input !py-1.5 !text-xs !w-auto"
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
              ))}
            </select>
          )}
          <button onClick={load} className="btn-secondary !py-2 !text-xs">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {t('common.refresh')}
          </button>
        </div>
      }
    >
      <LocalDevicesPanel canAssign={canEdit} />

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="panel p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up">
          {devices.map((d) => (
            <div key={d.id} className="panel p-5 flex items-center justify-between hover:shadow-card-hover transition-shadow">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${d.connected ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <Cpu size={20} className={d.connected ? 'text-emerald-600' : 'text-red-500'} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{d.type} · {d.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button
                    type="button"
                    disabled={updatingId === d.id}
                    onClick={() => toggleDevice(d)}
                    className="text-[10px] font-medium px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    {updatingId === d.id ? '...' : d.connected ? t('common.disconnect') : t('common.connect')}
                  </button>
                )}
                {d.connected ? (
                  <CheckCircle2 className="text-emerald-500" size={24} />
                ) : (
                  <XCircle className="text-red-400" size={24} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && devices.length === 0 && (
        <div className="empty-state panel min-h-[300px]">
          <Cpu size={32} className="mb-3 opacity-40" />
          <p>{t('devices.empty')}</p>
          <p className="text-sm text-slate-400 mt-1">
            {!isUtRole(user.role) ? t('devices.emptyHintStaff') : t('devices.emptyHintUt')}
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
