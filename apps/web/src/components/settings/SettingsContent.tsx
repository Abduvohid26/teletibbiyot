'use client';

import { useEffect, useState } from 'react';
import { Video, Wifi, Camera, User, Globe } from 'lucide-react';
import { MediaDevicePanel, MediaCameraPreview } from '@/components/video/MediaDevicePanel';
import { UtCameraMappingPanel } from '@/components/ut/UtCameraMappingPanel';
import { ProfileSettingsPanel } from '@/components/settings/ProfileSettingsPanel';
import { clearIceCache } from '@/lib/video-config';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LanguageSwitcher, useI18n } from '@/i18n';

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
  const { t } = useI18n();
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
          ? t('settings.turnOk')
          : t('settings.turnMissing'),
      );
    } catch {
      setTurnStatus(t('settings.turnFail'));
    }
  };

  if (compact) {
    const isUt = videoRole === 'ut';

    return (
      <div className={cn('ut-settings-grid', isUt && 'ut-settings-grid-cameras', className)}>
        <div id="video-audio" className="ut-settings-panel scroll-mt-4 min-w-0">
          <div className="panel-header !py-2 !px-3 bg-gradient-to-r from-violet-50/50 to-transparent">
            {isUt ? <Camera size={15} className="text-violet-600" /> : <Video size={15} className="text-violet-600" />}
            <span className="panel-title">{isUt ? t('settings.utCameras') : t('settings.videoAudio')}</span>
          </div>
          <div className="ut-settings-panel-body !p-2.5 overflow-y-auto flex flex-col gap-4 min-h-0">
            {isUt ? (
              <>
                <UtCameraMappingPanel
                  compact
                  onPrefsChange={() => clearIceCache()}
                />
                <section className="shrink-0 border-t border-slate-200 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {t('settings.extra')}
                  </p>
                  <MediaDevicePanel
                    role="ut"
                    compact
                    showPreview={false}
                    hideUtCameraMapping
                    onPrefsChange={() => clearIceCache()}
                  />
                </section>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500 leading-snug">
                  {t('settings.videoHint')}
                </p>
                <MediaDevicePanel role={videoRole} compact showPreview={false} onPrefsChange={() => clearIceCache()} />
              </>
            )}
            <div className="shrink-0 pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
                <Wifi size={14} className="shrink-0" />
                <span className="truncate">{t('settings.turnCheck')}</span>
              </div>
              <button type="button" onClick={checkTurn} className="btn-secondary !py-1 !px-2 !text-xs shrink-0">
                {t('settings.check')}
              </button>
            </div>
            {turnStatus && (
              <p className={cn('text-xs font-medium', turnStatus.includes('✓') ? 'text-emerald-600' : 'text-amber-600')}>
                {turnStatus}
              </p>
            )}
          </div>
        </div>

        <div className="ut-settings-panel ut-settings-profile">
          <div className="panel-header !py-2 !px-3">
            <Globe size={15} className="text-brand-600" />
            <span className="panel-title">{t('settings.languageTitle')}</span>
          </div>
          <div className="panel-body !p-3 space-y-2 border-b border-slate-200">
            <p className="text-xs text-slate-500 leading-snug">{t('settings.languageHint')}</p>
            <LanguageSwitcher />
          </div>
          <div className="panel-header !py-2 !px-3">
            <User size={15} className="text-brand-600" />
            <span className="panel-title">{t('settings.profile')}</span>
          </div>
          <div className="panel-body !p-3 flex flex-col gap-3 min-h-0 overflow-y-auto text-sm">
            <ProfileSettingsPanel compact />
            {!isUt && (
              <div className="mt-auto pt-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('settings.cameraCheck')}</p>
                <MediaCameraPreview role={videoRole} compact variant="card" />
              </div>
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
          <Globe size={18} className="text-brand-600" />
          <span className="panel-title">{t('settings.languageTitle')}</span>
        </div>
        <div className="panel-body space-y-3">
          <p className="text-sm text-slate-500">{t('settings.languageHint')}</p>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-header">
          <User size={18} className="text-brand-600" />
          <span className="panel-title">{t('settings.profileInfo')}</span>
        </div>
        <div className="panel-body">
          <ProfileSettingsPanel />
        </div>
      </div>

      <div id="video-audio" className="panel overflow-hidden scroll-mt-24">
        <div className="panel-header bg-gradient-to-r from-violet-50/50 to-transparent">
          <Video size={18} className="text-violet-600" />
          <span className="panel-title">
            {videoRole === 'ut' ? t('settings.utCameras') : t('settings.videoAudioFull')}
          </span>
        </div>
        <div className="panel-body">
          {videoRole === 'ut' ? (
            <div className="space-y-6">
              <UtCameraMappingPanel onPrefsChange={() => clearIceCache()} />
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">{t('settings.videoQuality')}</p>
                <MediaDevicePanel role="ut" showPreview={false} hideUtCameraMapping onPrefsChange={() => clearIceCache()} />
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-4">
                {t('settings.videoHintFull')}
              </p>
              <MediaDevicePanel role={videoRole} onPrefsChange={() => clearIceCache()} />
            </>
          )}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Wifi size={16} />
              <span>{t('settings.turnCheck')}</span>
            </div>
            <button type="button" onClick={checkTurn} className="btn-secondary !py-1.5 !text-xs">
              {t('settings.check')}
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
