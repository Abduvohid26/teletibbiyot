'use client';

import { useEffect, useRef } from 'react';
import { VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  placeholder = 'Kamera kutmoqda...',
  live = false,
  resolution,
}: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    } else {
      video.srcObject = null;
    }
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
          <p className="text-[10px] px-2 text-center">{placeholder}</p>
        </div>
      )}
      {label && (
        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
          {label}
        </span>
      )}
      {live && stream && (
        <span className="absolute top-2 right-2 live-badge !text-[9px] !py-0.5">
          <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
          JONLI
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
