'use client';

import { useEffect, useRef, useState } from 'react';
import { VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface VideoTileProps {
  stream: MediaStream | null;
  label?: string;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
  placeholder?: string;
  live?: boolean;
  resolution?: string;
}

export function VideoTile({
  stream,
  label,
  muted = true,
  mirror = false,
  className,
  placeholder,
  live = false,
  resolution,
}: VideoTileProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t('video.cameraWaiting');
  const ref = useRef<HTMLVideoElement>(null);
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    } else {
      video.srcObject = null;
    }
    setFrozen(false);
  }, [stream]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !stream) {
      setFrozen(false);
      return;
    }

    let lastMediaTime = -1;
    let stallTicks = 0;
    const timer = window.setInterval(() => {
      if (video.paused || video.ended || video.readyState < 2) {
        stallTicks = 0;
        setFrozen(false);
        return;
      }
      const mediaTime = video.currentTime;
      if (mediaTime === lastMediaTime) {
        stallTicks += 1;
      } else {
        stallTicks = 0;
      }
      lastMediaTime = mediaTime;
      setFrozen(stallTicks >= 3);
    }, 500);

    return () => window.clearInterval(timer);
  }, [stream]);

  return (
    <div className={cn('relative bg-slate-900 overflow-hidden', className)}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn('w-full h-full object-cover', mirror && 'mirror')}
      />
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-800/90">
          <VideoOff className="w-8 h-8" />
          <p className="text-[10px] px-2 text-center">{resolvedPlaceholder}</p>
        </div>
      )}
      {stream && frozen && (
        <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
          <span className="bg-black/70 text-white text-[11px] px-3 py-1.5 rounded-full">
            {t('video.frozenOverlay')}
          </span>
        </div>
      )}
      {label && (
        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
          {label}
        </span>
      )}
      {live && stream && !frozen && (
        <span
          className="absolute top-2 right-2 live-badge !p-1 !min-w-0"
          title={t('video.live')}
          aria-label={t('video.live')}
        >
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        </span>
      )}
      {resolution && resolution !== '—' && stream && (
        <span className="absolute top-2 left-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
          {resolution}
        </span>
      )}
    </div>
  );
}
