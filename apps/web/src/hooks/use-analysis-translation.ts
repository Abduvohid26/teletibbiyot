'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type AiAnalysis } from '@/lib/api';
import { localizeAnalysis } from '@/lib/clinical-conclusion';
import { useI18n } from '@/i18n';

interface UseAnalysisTranslationResult {
  /** Interfeys tilidagi (yoki asl) tahlil — shuni render qilish kerak */
  analysis?: AiAnalysis;
  /** Hozir tarjima so'ralmoqda */
  translating: boolean;
  /** Tarjima urinishi muvaffaqiyatsiz tugadi */
  failed: boolean;
  /** Qo'lda qayta urinish */
  retry: () => void;
}

/**
 * Interfeys tili almashganda AI xulosani AVTOMATIK o'sha tilga o'giradi.
 *
 * Ilgari foydalanuvchi "Shu tilga o'girish" tugmasini bosishi kerak edi va tugmani
 * bosmaguncha boshqa tildagi matn ko'rinardi. Endi til almashishi bilan so'rov
 * ketadi, UI da esa "Tarjima qilinmoqda..." holati ko'rsatiladi.
 *
 * Har bir (konsultatsiya + til) juftligi uchun avtomatik urinish faqat bir marta
 * bo'ladi — server tarjima qila olmasa cheksiz sikl bo'lib qolmaydi.
 */
export function useAnalysisTranslation(
  analysis: AiAnalysis | undefined,
  consultationId?: string,
  onRefresh?: () => void,
): UseAnalysisTranslationResult {
  const { locale } = useI18n();
  const [override, setOverride] = useState<AiAnalysis | null>(null);
  const [translating, setTranslating] = useState(false);
  const [failed, setFailed] = useState(false);
  const attempted = useRef<Set<string>>(new Set());

  // Boshqa konsultatsiyaga o'tilganda oldingi tarjima natijasi qolib ketmasin
  useEffect(() => {
    setOverride(null);
    setFailed(false);
    attempted.current.clear();
  }, [consultationId, analysis?.id]);

  const effective = override ?? analysis;

  const localized = useMemo(
    () => (effective ? localizeAnalysis(effective, locale) : null),
    [effective, locale],
  );

  const needsTranslation = !!effective && !!localized && !localized.available;

  const request = useCallback(
    async (force = false) => {
      if (!consultationId || !effective) return;
      const key = `${consultationId}:${locale}`;
      if (!force && attempted.current.has(key)) return;
      attempted.current.add(key);
      setTranslating(true);
      setFailed(false);
      try {
        const translated = await api.localizeAnalysis(consultationId);
        const ok = localizeAnalysis(translated, locale).available;
        if (ok) {
          setOverride(translated);
          onRefresh?.();
        } else {
          setFailed(true);
        }
      } catch {
        setFailed(true);
      } finally {
        setTranslating(false);
      }
    },
    [consultationId, effective, locale, onRefresh],
  );

  useEffect(() => {
    if (!needsTranslation || translating) return;
    void request();
  }, [needsTranslation, translating, request]);

  const retry = useCallback(() => {
    void request(true);
  }, [request]);

  return {
    analysis: localized?.available ? localized.analysis : effective,
    // consultationId bo'lmasa tarjima so'ray olmaymiz — "kuting" holatida qotib qolmasin
    translating: !!consultationId && (translating || (needsTranslation && !failed)),
    failed: failed && needsTranslation,
    retry,
  };
}
