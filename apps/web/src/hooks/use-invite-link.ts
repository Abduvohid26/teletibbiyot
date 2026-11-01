'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useI18n } from '@/i18n';

/**
 * Konsilium xonasiga havola: serverdan imzolangan token olinadi va to'liq URL
 * buferga nusxalanadi. Havolani ochgan shifokor O'Z hisobi bilan kirib, konsilium
 * a'zosi bo'ladi.
 */
export function useInviteLink(consultationId?: string) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const copy = useCallback(async () => {
    if (!consultationId || busy) return;
    setBusy(true);
    try {
      const { token } = await api.createConsiliumInviteLink(consultationId);
      const url = `${window.location.origin}/dashboard/join/${token}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        /* http yoki ruxsat yo'q — havolani toastda ko'rsatamiz */
      }
      toast.success(copied ? t('consilium.linkCopied') : t('consilium.linkReady'), {
        description: copied ? t('consilium.linkHint') : url,
        duration: copied ? 7000 : Infinity,
      });
    } catch (err) {
      toast.error(t('consilium.linkError'), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }, [busy, consultationId, t]);

  return { copy, busy };
}
