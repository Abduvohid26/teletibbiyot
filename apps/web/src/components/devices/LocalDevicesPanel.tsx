'use client';

import { useMemo, useState } from 'react';
import { Usb, Mic, RefreshCw, MonitorPlay } from 'lucide-react';
import { useMediaDevices } from '@/hooks/use-media-devices';
import { loadMediaPreferences, saveMediaPreferences, type MediaPreferences } from '@/lib/media-preferences';
import { UT_CAMERA_SLOTS, type UtCameraSlotId } from '@/lib/ut-camera-slots';
import { useI18n } from '@/i18n';

/**
 * Shu kompyuterga jismonan ulangan qurilmalar (USB / HDMI-capture orqali
 * kelayotgan UZI apparati ham shu ro'yxatga tushadi). Ethernet orqali ulangan
 * apparat brauzerga ko'rinmaydi — u backend gateway orqali `DeviceStatus`
 * ro'yxatida chiqadi.
 */
export function LocalDevicesPanel({ canAssign }: { canAssign: boolean }) {
  const { t } = useI18n();
  const { videoInputs, audioInputs, permissionGranted, error, refresh, requestPermission } = useMediaDevices();
  const [prefs, setPrefs] = useState<MediaPreferences>(() => loadMediaPreferences());

  const slotByDevice = useMemo(() => {
    const map: Record<string, UtCameraSlotId> = {};
    for (const slot of UT_CAMERA_SLOTS) {
      const id = prefs.utCameraMapping?.[slot.id];
      if (id) map[id] = slot.id;
    }
    return map;
  }, [prefs]);

  const assign = (deviceId: string, slotId: string) => {
    const mapping = { ...prefs.utCameraMapping };
    for (const slot of UT_CAMERA_SLOTS) {
      if (mapping[slot.id] === deviceId) delete mapping[slot.id];
    }
    if (slotId) mapping[slotId] = deviceId;
    setPrefs(saveMediaPreferences({ utCameraMapping: mapping }));
  };

  return (
    <section className="panel p-5 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Usb size={16} className="text-brand-600" /> {t('devices.localTitle')}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-snug">{t('devices.localHint')}</p>
        </div>
        <button
          type="button"
          onClick={() => refresh(true)}
          className="btn-secondary !py-2 !text-xs shrink-0 inline-flex items-center gap-1"
        >
          <RefreshCw size={14} /> {t('common.refresh')}
        </button>
      </div>

      {permissionGranted === false && (
        <div className="mb-3 text-xs text-amber-800 bg-amber-50 ring-1 ring-amber-100 rounded-xl p-2.5">
          {t('devices.localPermission')}{' '}
          <button type="button" onClick={requestPermission} className="text-brand-700 font-bold hover:underline">
            {t('video.grantPermission')}
          </button>
        </div>
      )}
      {error && <div className="mb-3 text-xs text-red-700 bg-red-50 rounded-lg p-2.5">{error}</div>}

      {videoInputs.length === 0 && audioInputs.length === 0 ? (
        <p className="text-sm text-slate-400">{t('devices.localEmpty')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {videoInputs.map((d) => (
            <div key={d.deviceId} className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-50 shrink-0">
                <MonitorPlay size={18} className="text-brand-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{d.label}</p>
                <p className="text-[11px] text-slate-500">{t('devices.localVideo')}</p>
              </div>
              {canAssign ? (
                <select
                  className="input !py-1.5 !text-xs !w-auto shrink-0"
                  value={slotByDevice[d.deviceId] || ''}
                  onChange={(e) => assign(d.deviceId, e.target.value)}
                >
                  <option value="">{t('devices.localUnassigned')}</option>
                  {UT_CAMERA_SLOTS.map((s) => (
                    <option key={s.id} value={s.id}>{s.num}. {t(s.labelKey)}</option>
                  ))}
                </select>
              ) : (
                <span className="text-[11px] text-slate-500 shrink-0">
                  {slotByDevice[d.deviceId]
                    ? t(UT_CAMERA_SLOTS.find((s) => s.id === slotByDevice[d.deviceId])!.shortLabelKey)
                    : t('devices.localUnassigned')}
                </span>
              )}
            </div>
          ))}
          {audioInputs.map((d) => (
            <div key={d.deviceId} className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 shrink-0">
                <Mic size={18} className="text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{d.label}</p>
                <p className="text-[11px] text-slate-500">{t('devices.localAudio')}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 mt-3 leading-snug">{t('devices.localNetworkHint')}</p>
    </section>
  );
}
