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
  /** Tanlov o'zgargani haqida ota-komponentga xabar (qayta ulash bannerini ko'rsatish uchun) */
  onChanged?: () => void;
}

/**
 * Katakchaning o'zida kamera tanlash. Tanlov `utCameraMapping` ga yoziladi;
 * oqimlar xonaga ulanishda olinadi, shuning uchun o'zgarish qayta ulangandan
 * keyin kuchga kiradi (buni ota-komponent banner orqali bildiradi).
 */
export function UtCameraSlotPicker({ slotId, onChanged }: UtCameraSlotPickerProps) {
  const { t } = useI18n();
  const { devices, refresh } = useMediaDevices();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');

  const videoInputs = devices.filter((d) => d.kind === 'videoinput');

  useEffect(() => {
    setSelected(loadMediaPreferences().utCameraMapping[slotId] || '');
  }, [slotId, open]);

  // Ro'yxat ochilganda yorliqlar bo'sh bo'lsa — ruxsat so'rab yangilaymiz
  useEffect(() => {
    if (open && videoInputs.every((d) => !d.label)) void refresh(true);
  }, [open, videoInputs, refresh]);

  const choose = (deviceId: string) => {
    const prefs = loadMediaPreferences();
    const mapping = { ...prefs.utCameraMapping };

    // Bitta kamera ikki katakchada bo'lmasin — avvalgi egasidan olib tashlaymiz
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
  onClick,
}: {
  label: string;
  active: boolean;
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
      <span className="truncate">{label}</span>
    </button>
  );
}
