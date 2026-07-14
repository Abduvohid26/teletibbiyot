'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DoctorShell } from '@/components/layout/DoctorShell';
import { SimplePageLayout } from '@/components/layout/SimplePageLayout';
import { Alert } from '@/components/ui/Alert';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Shield, QrCode, User, Building2, Video, Wifi } from 'lucide-react';
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
  const { refreshUser } = useAuth();
  const [mfaSetup, setMfaSetup] = useState<{ qrCode: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [message, setMessage] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [turnStatus, setTurnStatus] = useState<string>('');
  const searchParams = useSearchParams();
  const mfaRequired = searchParams.get('mfa') === 'required';

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

  const handleSetupMfa = async () => {
    try {
      const res = await api.setupMfa();
      setMfaSetup(res);
      setMessage('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Xatolik');
    }
  };

  const handleEnableMfa = async () => {
    try {
      await api.enableMfa(mfaCode);
      setMessage('MFA muvaffaqiyatli yoqildi');
      setMfaSetup(null);
      setMfaCode('');
      await refreshUser();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Xatolik');
    }
  };

  const handleDisableMfa = async () => {
    try {
      await api.disableMfa(disableCode);
      setMessage('MFA o\'chirildi');
      setDisableCode('');
      await refreshUser();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Xatolik');
    }
  };

  if (authLoading || !user) return null;

  const pageBody = (
    <div className="w-full max-w-none space-y-5 animate-slide-up">
      {mfaRequired && !user.mfaEnabled && (
        <div className="panel p-4 bg-amber-50 border-amber-200 text-amber-900 text-sm">
          Production siyosati: hisobingiz uchun MFA majburiy. Quyida sozlang.
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="panel overflow-hidden h-full">
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

        <div className="panel overflow-hidden h-full">
          <div className="panel-header bg-gradient-to-r from-brand-50/50 to-transparent">
            <Shield size={18} className="text-brand-600" />
            <span className="panel-title">Ikki bosqichli autentifikatsiya (MFA)</span>
          </div>
          <div className="panel-body">
            <p className="text-sm text-slate-500 mb-4">
              Holat:{' '}
              <span className={`font-semibold ${user?.mfaEnabled ? 'text-emerald-600' : 'text-amber-600'}`}>
                {user?.mfaEnabled ? 'Yoqilgan' : 'O\'chirilgan'}
              </span>
            </p>

            {!user?.mfaEnabled && !mfaSetup && (
              <button onClick={handleSetupMfa} className="btn-primary">
                MFA ni sozlash
              </button>
            )}

            {mfaSetup && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <QrCode size={16} /> Google Authenticator bilan skanerlang
                </div>
                <img src={mfaSetup.qrCode} alt="MFA QR" className="w-48 h-48 border border-slate-200 rounded-xl shadow-sm" />
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="6 xonali kod"
                  className="input max-w-xs tracking-widest text-center font-mono"
                  maxLength={6}
                />
                <button onClick={handleEnableMfa} className="btn-primary">MFA ni yoqish</button>
              </div>
            )}

            {user?.mfaEnabled && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <p className="text-xs text-slate-500">MFA ni o&apos;chirish (faqat ixtiyoriy rollar)</p>
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="6 xonali kod"
                  className="input max-w-xs tracking-widest text-center font-mono"
                  maxLength={6}
                />
                <button type="button" onClick={handleDisableMfa} className="btn-secondary block">
                  MFA ni o&apos;chirish
                </button>
              </div>
            )}

            {message && (
              <Alert variant={message.includes('muvaffaqiyatli') ? 'success' : 'error'} className="mt-4">
                {message}
              </Alert>
            )}
          </div>
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
    <SimplePageLayout title="Sozlamalar" subtitle="Profil va xavfsizlik" backHref="/ut" backLabel="UT panel">
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
