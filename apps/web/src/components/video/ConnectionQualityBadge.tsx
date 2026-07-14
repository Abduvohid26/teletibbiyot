'use client';

import { cn } from '@/lib/utils';
import { ConnectionQuality, QUALITY_LABELS } from '@/lib/webrtc-quality';
import { Signal, SignalHigh, SignalLow, SignalMedium, SignalZero } from 'lucide-react';

const ICONS: Record<ConnectionQuality, React.ElementType> = {
  excellent: Signal,
  good: SignalHigh,
  fair: SignalMedium,
  poor: SignalLow,
  unknown: SignalZero,
};

const COLORS: Record<ConnectionQuality, string> = {
  excellent: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  good: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25',
  fair: 'text-amber-300 bg-amber-500/20 border-amber-500/30',
  poor: 'text-red-300 bg-red-500/20 border-red-500/30',
  unknown: 'text-slate-400 bg-slate-500/20 border-slate-500/30',
};

interface ConnectionQualityBadgeProps {
  quality: ConnectionQuality;
  bitrateKbps?: number;
  resolution?: string;
  fps?: number;
  compact?: boolean;
  className?: string;
}

export function ConnectionQualityBadge({
  quality,
  bitrateKbps,
  resolution,
  fps,
  compact,
  className,
}: ConnectionQualityBadgeProps) {
  const Icon = ICONS[quality];
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border backdrop-blur-sm text-[10px] font-medium px-2 py-0.5',
        COLORS[quality],
        className,
      )}
      title={`${QUALITY_LABELS[quality]}${bitrateKbps ? ` · ${bitrateKbps} kbps` : ''}`}
    >
      <Icon size={compact ? 10 : 12} />
      <span>{QUALITY_LABELS[quality]}</span>
      {!compact && resolution && resolution !== '—' && (
        <span className="opacity-75">· {resolution}{fps ? ` @${fps}fps` : ''}</span>
      )}
    </div>
  );
}
