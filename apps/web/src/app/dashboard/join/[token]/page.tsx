'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Users } from 'lucide-react';
import { isMtDoctor } from '@ishifo/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { markJoined } from '@/lib/video-room-session';
import { dispatchDoctorSelect } from '@/hooks/use-doctor-header-data';
import { getRoleHomePath } from '@/lib/auth-utils';
import { useI18n } from '@/i18n';

/**
 * Konsilium havolasi: shifokor o'z hisobi bilan kirgan bo'lsa — konsiliumga
 * qo'shiladi va bemor ish joyi video bilan ochiladi. Kirmagan bo'lsa middleware
 * avval login'ga yuboradi va keyin shu yerga qaytaradi.
 */
export default function JoinConsiliumPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (loading || !user || started.current) return;
    started.current = true;
    if (!isMtDoctor(user.role)) {
      setError(t('consilium.linkDoctorsOnly'));
      return;
    }
    api
      .joinConsiliumByInvite(token)
      .then(({ consultationId }) => {
        // Video lobby'siz ulanadi (havolani bosishning o'zi "qo'shilaman" degani)
        markJoined(consultationId, 'mt');
        dispatchDoctorSelect(consultationId);
        router.replace('/dashboard');
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('consilium.linkError')));
  }, [loading, user, token, router, t]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-950 text-gold-300">
        {error ? <AlertTriangle size={26} /> : <Users size={26} />}
      </span>
      {error ? (
        <>
          <h1 className="text-lg font-bold text-brand-950">{t('consilium.linkFailedTitle')}</h1>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => router.replace(user ? getRoleHomePath(user.role) : '/login')}
            className="mt-5 rounded-xl bg-brand-950 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            {t('consilium.linkGoHome')}
          </button>
        </>
      ) : (
        <>
          <h1 className="text-lg font-bold text-brand-950">{t('consilium.linkJoining')}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <Loader2 size={14} className="animate-spin" /> {t('consilium.linkJoiningHint')}
          </p>
        </>
      )}
    </div>
  );
}
