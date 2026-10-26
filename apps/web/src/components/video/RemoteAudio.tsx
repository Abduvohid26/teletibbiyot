'use client';

import { useEffect, useMemo, useRef } from 'react';

interface RemoteAudioProps {
  /** Barcha ishtirokchilar ovozi jamlangan YAGONA oqim */
  stream: MediaStream | null;
  /** Dinamik yoqilganmi */
  enabled: boolean;
  /** Oqimdagi trek soni — o'zgarganda ro'yxat qayta quriladi */
  trackCount?: number;
}

/**
 * Uzoq ishtirokchilar ovozi — har bir trek uchun alohida yashirin <audio>.
 *
 * Nega alohida: Chrome bitta <audio> ga berilgan MediaStream'dagi audio
 * treklardan faqat BIRINCHISINI ijro etadi. Konsiliumda (3+ kishi) shu sabab
 * har kim faqat bitta suhbatdoshni eshitardi.
 *
 * Autoplay: ruxsat sahifaga (foydalanuvchi "Qo'shilish"ni bosgan) bog'liq,
 * shuning uchun keyin qo'shilgan elementlar ham ijro etiladi. Baribir rad
 * etilsa — birinchi bosish/tugmada qayta urinamiz.
 */
export function RemoteAudio({ stream, enabled, trackCount = 0 }: RemoteAudioProps) {
  const tracks = useMemo(
    () => stream?.getAudioTracks() ?? [],
    // trackCount — oqim obyekti o'zgarmasdan treklar qo'shilganini bildiradi
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stream, trackCount],
  );

  if (!tracks.length) return null;
  return (
    <>
      {tracks.map((track) => (
        <TrackAudio key={track.id} track={track} enabled={enabled} />
      ))}
    </>
  );
}

function TrackAudio({ track, enabled }: { track: MediaStreamTrack; enabled: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const stream = useMemo(() => new MediaStream([track]), [track]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.muted = !enabled;

    let cancelled = false;
    const resume = () => {
      void el.play().catch(() => undefined);
      document.removeEventListener('click', resume);
      document.removeEventListener('keydown', resume);
    };

    void el.play().catch(() => {
      if (cancelled) return;
      // Autoplay bloklandi — foydalanuvchi biror joyni bosishi bilan yoqamiz
      document.addEventListener('click', resume);
      document.addEventListener('keydown', resume);
    });

    return () => {
      cancelled = true;
      document.removeEventListener('click', resume);
      document.removeEventListener('keydown', resume);
    };
  }, [stream, enabled]);

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}
