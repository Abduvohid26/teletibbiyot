'use client';

import { Suspense } from 'react';
import DicomViewContent from './DicomViewContent';
import { useI18n } from '@/i18n';

function DicomViewFallback() {
  const { t } = useI18n();
  return <div className="p-8 text-slate-500">{t('common.loading')}</div>;
}

export default function DicomViewPage() {
  return (
    <Suspense fallback={<DicomViewFallback />}>
      <DicomViewContent />
    </Suspense>
  );
}
