'use client';

import { useEffect, useState } from 'react';
import { User, Building2, Video, Wifi } from 'lucide-react';
import { MediaDevicePanel } from '@/components/video/MediaDevicePanel';
import { clearIceCache } from '@/lib/video-config';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface SettingsUser {
  fullName?: string;
  email?: string;
  role?: string;
  facility?: { name?: string };
}

interface SettingsContentProps {
  user: SettingsUser;
  videoRole: 'mt' | 'ut';
  compact?: boolean;
  className?: string;
}

export function SettingsContent({ user, videoRole, compact, className }: SettingsContentProps) {
  const [turnStatus, setTurnStatus] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.querySelector(hash);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const checkTurn = async () => {
    try {
      clearIceCache();
      const res = await api.getVideoHealthCheck();
      setTurnStatus(
        (res.webrtc as { turnConfigured?: boolean })?.turnConfigured
          ? 'TURN server sozlangan ✓'
          : 'TURN server topilmadi — uzoq hududlarda video uzilishi mumkin',
      );
    } catch {
      setTurnStatus('Tekshiruv amalga oshmadi');
    }
  };

  if (compact) {
    return (
      <div className={cn('ut-settings-grid', className)}>
        <div className="ut-settings-panel">
          <div className="panel-header !py-2 !px-3">
            <User size={15} className="text-brand-600" />
            <span className="panel-title !text-xs">Profil</span>
          </div>
          <div className="panel-body !p-3 grid grid-cols-2 gap-x-2 gap-y-0 text-xs">
            <InfoRow label="Ism" value={user.fullName} compact />
            <InfoRow label="Email" value={user.email} compact />
            <InfoRow label="Rol" value={user.role} compact />
            <InfoRow label="Muassasa" value={user.facility?.name || '—'} icon={Building2} compact />
          </div>
        </div>

        <div id="video-audio" className="ut-settings-panel scroll-mt-4">
          <div className="panel-header !py-2 !px-3 bg-gradient-to-r from-violet-50/50 to-transparent">
            <Video size={15} className="text-violet-600" />
            <span className="panel-title !text-xs">Video va ovoz</span>
          </div>
          <div className="ut-settings-panel-body !p-2.5">
            <p className="text-[10px] text-slate-500 mb-2 leading-snug">
              Kamera, mikrofon va video sifatini konsultatsiyadan oldin sozlang.
            </p>
            <MediaDevicePanel role={videoRole} compact onPrefsChange={() => clearIceCache()} />
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 min-w-0">
                <Wifi size={14} className="shrink-0" />
                <span className="truncate">TURN / WebRTC tekshiruvi</span>
              </div>
              <button type="button" onClick={checkTurn} className="btn-secondary !py-1 !px-2 !text-[10px] shrink-0">
                Tekshirish
              </button>
            </div>
            {turnStatus && (
              <p className={cn('text-[11px] mt-1.5 font-medium', turnStatus.includes('✓') ? 'text-emerald-600' : 'text-amber-600')}>
                {turnStatus}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full max-w-none space-y-5 animate-slide-up', className)}>
      <div className="panel overflow-hidden">
        <div className="panel-header">
          <User size={18} className="text-brand-600" />
          <span className="panel-title">Profil ma&apos;lumotlari</span>
        </div>
        <div className="panel-body space-y-3 text-sm">
          <InfoRow label="Ism" value={user.fullName} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Rol" value={user.role} />
          <InfoRow label="Muassasa" value={user.facility?.name || '—'} icon={Building2} />
        </div>
      </div>

      <div id="video-audio" className="panel overflow-hidden scroll-mt-24">
        <div className="panel-header bg-gradient-to-r from-violet-50/50 to-transparent">
          <Video size={18} className="text-violet-600" />
          <span className="panel-title">Video va ovoz sozlamalari</span>
        </div>
        <div className="panel-body">
          <p className="text-sm text-slate-500 mb-4">
            Kamera, mikrofon va video sifatini konsultatsiyadan oldin sozlang. Tanlovlar brauzerda saqlanadi.
          </p>
          <MediaDevicePanel role={videoRole} onPrefsChange={() => clearIceCache()} />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Wifi size={16} />
              <span>TURN / WebRTC tarmoq tekshiruvi</span>
            </div>
            <button type="button" onClick={checkTurn} className="btn-secondary !py-1.5 !text-xs">
              Tekshirish
            </button>
          </div>
          {turnStatus && (
            <p className={`text-sm mt-2 font-medium ${turnStatus.includes('✓') ? 'text-emerald-600' : 'text-amber-600'}`}>
              {turnStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
  compact,
}: {
  label: string;
  value?: string;
  icon?: React.ElementType;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-col gap-0.5 min-w-0 border-b border-slate-50 last:border-0 py-1">
        <span className="text-slate-500 flex items-center gap-1 text-[10px]">
          {Icon && <Icon size={10} />}
          {label}
        </span>
        <span className="font-medium text-slate-800 truncate text-[11px]">
          {value || '—'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-slate-500 flex items-center gap-1.5">
        {Icon && <Icon size={14} />}
        {label}
      </span>
      <span className="font-medium text-slate-800 text-right truncate ml-2 text-sm">
        {value || '—'}
      </span>
    </div>
  );
}
