import { Suspense } from 'react';
import DicomViewerContent from './DicomViewerContent';

export default function DicomViewerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Yuklanmoqda...</div>}>
      <DicomViewerContent />
    </Suspense>
  );
}
