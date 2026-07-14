import { Suspense } from 'react';
import DicomViewContent from './DicomViewContent';

export default function DicomViewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Yuklanmoqda...</div>}>
      <DicomViewContent />
    </Suspense>
  );
}
