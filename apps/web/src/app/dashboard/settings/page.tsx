'use client';

import { Suspense, useState } from 'react';
import { DoctorShell } from '@/components/layout/DoctorShell';
import { SimplePageLayout } from '@/components/layout/SimplePageLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import { User, Building2, Video, Wifi } from 'lucide-react';
import { MediaDevicePanel } from '@/components/video/MediaDevicePanel';
import { clearIceCache } from '@/lib/video-config';
import { UserRole, isUtRole, isMtStaff } from '@ishifo/shared';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500 animate-pulse">Sozlamalar yuklanmoqda...</div>}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const { user, loading: authLoading } = useRequireAuth();
  const [turnStatus, setTurnStatus] = useState<string>('');

  const isUt = isUtRole(user?.role || '');
  const videoRole = isUt ? 'ut' : 'mt';

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

  if (authLoading || !user) return null;

  const pageBody = (
    <div className="w-full max-w-none space-y-5 animate-slide-up">
      <div className="panel overflow-hidden">
        <div className="panel-header">
          <User size={18} className="text-brand-600" />
          <span className="panel-title">Profil ma&apos;lumotlari</span>
        </div>
        <div className="panel-body space-y-3 text-sm">
          <InfoRow label="Ism" value={user?.fullName} />
          <InfoRow label="Email" value={user?.email} />
          <InfoRow label="Rol" value={user?.role} />
          <InfoRow label="Muassasa" value={user?.facility?.name || '—'} icon={Building2} />
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

  if (isMtStaff(user.role) || user.role === UserRole.ADMIN) {
    return <DoctorShell scrollable>{pageBody}</DoctorShell>;
  }

  return (
    <SimplePageLayout title="Sozlamalar" subtitle="Profil va video sozlamalari" backHref="/ut" backLabel="UT panel">
      {pageBody}
    </SimplePageLayout>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-slate-500 flex items-center gap-1.5">
        {Icon && <Icon size={14} />}
        {label}
      </span>
      <span className="font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
}
