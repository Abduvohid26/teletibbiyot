'use client';

import { useEffect, useRef } from 'react';

interface RemoteAudioProps {
  /** Barcha ishtirokchilar ovozi jamlangan YAGONA oqim */
  stream: MediaStream | null;
  /** Dinamik yoqilganmi */
  enabled: boolean;
  /** Oqimdagi trek soni — o'zgarganda ijro qayta urinib ko'riladi */
  trackCount?: number;
}

/**
 * Uzoq ishtirokchilar ovozi uchun YAGONA <audio> elementi.
 *
 * Nega yagona: brauzerning autoplay ruxsati elementga bog'liq. Har yangi
 * ishtirokchiga alohida element yaratilsa, uchinchi odam qo'shilganda o'sha
 * yangi element bloklanib jim qolishi mumkin ("operator ovozi kelmay qoldi").
 * Bitta element bir marta ijroga tushadi va keyin unga trek qo'shilishi
 * ovozni darhol eshittiradi.
 *
 * Qo'shimcha himoya: `play()` rad etilsa, birinchi foydalanuvchi harakatida
 * (bosish/tugma) avtomatik qayta urinamiz.
 */
export function RemoteAudio({ stream, enabled, trackCount = 0 }: RemoteAudioProps) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.muted = !enabled;

    let cancelled = false;
    const tryPlay = () => el.play().catch(() => undefined);

    void el.play().catch(() => {
      if (cancelled) return;
      // Autoplay bloklandi — foydalanuvchi biror joyni bosishi bilan yoqamiz
      const resume = () => {
        void tryPlay();
        document.removeEventListener('click', resume);
        document.removeEventListener('keydown', resume);
      };
      document.addEventListener('click', resume);
      document.addEventListener('keydown', resume);
    });

    return () => {
      cancelled = true;
    };
  }, [stream, enabled, trackCount]);

  if (!stream) return null;
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}
