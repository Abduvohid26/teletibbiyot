'use client';

import { Suspense } from 'react';
import DicomViewerContent from './DicomViewerContent';
import { useI18n } from '@/i18n';

function DicomFallback() {
  const { t } = useI18n();
  return <div className="p-8 text-slate-500">{t('common.loading')}</div>;
}

export default function DicomViewerPage() {
  return (
    <Suspense fallback={<DicomFallback />}>
      <DicomViewerContent />
    </Suspense>
  );
}
