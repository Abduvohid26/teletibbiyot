'use client';

import { useEffect, useState } from 'react';
import { Camera, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaDevices } from '@/hooks/use-media-devices';
import { loadMediaPreferences, saveMediaPreferences } from '@/lib/media-preferences';
import { useI18n } from '@/i18n';

interface UtCameraSlotPickerProps {
  /** Katakcha identifikatori: main | close | room | equipment */
  slotId: string;
  /** Ochib bo'lmagan kameralar — ro'yxatda "band" deb belgilanadi */
  busyDeviceIds?: string[];
  /** Tanlov o'zgargani haqida ota-komponentga xabar — u oqimlarni qayta oladi */
  onChanged?: () => void;
}

/**
 * Katakchaning o'zida kamera tanlash. Tanlov `utCameraMapping` ga yoziladi va
 * ota-komponent uni darhol qo'llaydi. Taqsimot eksklyuziv: allaqachon boshqa
 * katakchada turgan kamera tanlansa, u o'sha yerdan ko'chib keladi.
 */
export function UtCameraSlotPicker({
  slotId,
  busyDeviceIds = [],
  onChanged,
}: UtCameraSlotPickerProps) {
  const { t } = useI18n();
  const { devices, refresh } = useMediaDevices();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');

  const [usedElsewhere, setUsedElsewhere] = useState<Set<string>>(new Set());

  const videoInputs = devices.filter((d) => d.kind === 'videoinput');

  useEffect(() => {
    const mapping = loadMediaPreferences().utCameraMapping;
    setSelected(mapping[slotId] || '');
    setUsedElsewhere(
      new Set(
        Object.entries(mapping)
          .filter(([key, value]) => key !== slotId && !!value)
          .map(([, value]) => value),
      ),
    );
  }, [slotId, open]);

  // Ro'yxat ochilganda yorliqlar bo'sh bo'lsa — ruxsat so'rab yangilaymiz
  useEffect(() => {
    if (open && videoInputs.every((d) => !d.label)) void refresh(true);
  }, [open, videoInputs, refresh]);

  const choose = (deviceId: string) => {
    const prefs = loadMediaPreferences();
    const mapping = { ...prefs.utCameraMapping };

    // Har katakchaga alohida kamera: tanlangan kamera avvalgi katakchadan ko'chiriladi
    if (deviceId) {
      for (const key of Object.keys(mapping)) {
        if (key !== slotId && mapping[key] === deviceId) mapping[key] = '';
      }
    }
    mapping[slotId] = deviceId;

    saveMediaPreferences({ utCameraMapping: mapping });
    setSelected(deviceId);
    setOpen(false);
    onChanged?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={t('media.pickCameraForSlot')}
        aria-label={t('media.pickCameraForSlot')}
        className="absolute top-1 right-1 z-20 rounded bg-black/65 p-1 text-white/80 hover:bg-black/85 hover:text-white"
      >
        <Camera size={12} />
      </button>

      {open && (
        <>
          <div className="absolute inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-7 right-1 z-30 w-52 max-h-40 overflow-y-auto rounded-lg bg-slate-900 ring-1 ring-white/15 shadow-xl py-1">
            <SlotOption
              label={t('media.slotNotUsed')}
              active={!selected}
              onClick={() => choose('')}
            />
            {videoInputs.map((d) => (
              <SlotOption
                key={d.deviceId}
                label={d.label || t('media.unnamedCamera')}
                active={selected === d.deviceId}
                hint={
                  busyDeviceIds.includes(d.deviceId)
                    ? t('media.cameraBusyShort')
                    : usedElsewhere.has(d.deviceId)
                      ? t('media.movesFromOtherSlot')
                      : undefined
                }
                busy={busyDeviceIds.includes(d.deviceId)}
                onClick={() => choose(d.deviceId)}
              />
            ))}
            {videoInputs.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-slate-400">{t('media.noCameras')}</p>
            )}
          </div>
        </>
      )}
    </>
  );
}

function SlotOption({
  label,
  active,
  hint,
  busy,
  onClick,
}: {
  label: string;
  active: boolean;
  hint?: string;
  /** Kamera ochilmadi — tanlash mumkin, lekin ogohlantiramiz */
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-[11px] hover:bg-white/10',
        active ? 'text-emerald-300' : 'text-slate-200',
      )}
    >
      <Check size={11} className={cn('shrink-0', active ? 'opacity-100' : 'opacity-0')} />
      <span className={cn('truncate', busy && 'text-slate-400')}>{label}</span>
      {hint && (
        <span className={cn('ml-auto shrink-0 text-[9px]', busy ? 'text-amber-400' : 'text-slate-400')}>
          {hint}
        </span>
      )}
    </button>
  );
}
