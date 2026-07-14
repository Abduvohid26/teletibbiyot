'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api, Consultation } from '@/lib/api';
import { ROLES_MT_DASHBOARD, ROLES_UT } from '@/lib/roles';
import { Scan, ExternalLink, FileImage } from 'lucide-react';
import { toast } from '@/lib/toast';

interface DicomStudy {
  id: string;
  fileName: string;
  fileType: string;
  viewerType: string;
  aiSummary?: string | null;
}

export default function DicomViewerContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth([...ROLES_MT_DASHBOARD, ...ROLES_UT]);
  const searchParams = useSearchParams();
  const consultationId = searchParams.get('consultationId') || '';
  const [studies, setStudies] = useState<DicomStudy[]>([]);
  const [recent, setRecent] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user) return;
    api.getConsultationsList({ limit: 10 })
      .then((res) => setRecent(res.items || []))
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Konsultatsiyalar ro\'yxati yuklanmadi:', err);
        }
      });
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user || !consultationId) return;
    setLoading(true);
    api
      .listDicomStudies(consultationId)
      .then(setStudies)
      .catch((err) => setError(err instanceof Error ? err.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, [authLoading, user, consultationId]);

  const openViewer = async (attachmentId: string) => {
    try {
      const { url, viewerHint } = await api.getDicomViewerUrl(attachmentId);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast(viewerHint || 'Fayl havolasi mavjud emas', 'info');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ko\'rish xatosi', 'error');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Scan className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">DICOM / Tasvir ko&apos;rish</h1>
            <p className="text-slate-600 text-sm">Rentgen, MRT, UZI va DICOM fayllar</p>
          </div>
        </div>

        {!consultationId && (
          <div className="panel p-4 space-y-3">
            <p className="text-sm text-slate-600">Konsultatsiyani tanlang:</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/dicom?consultationId=${c.id}`)}
                  className="btn-secondary !text-xs"
                >
                  {c.patient?.fullName || c.id.slice(0, 8)} — {c.status}
                </button>
              ))}
            </div>
            {recent.length === 0 && (
              <p className="text-xs text-slate-400">Faol konsultatsiyalar topilmadi</p>
            )}
          </div>
        )}

        {consultationId && (
          <p className="text-xs text-slate-500">
            Konsultatsiya: <code className="bg-slate-100 px-1 rounded">{consultationId}</code>
            {' · '}
            <Link href="/dashboard/dicom" className="text-brand-600 hover:underline">Boshqasini tanlash</Link>
          </p>
        )}

        {error && <p className="text-red-600">{error}</p>}
        {loading && <p className="text-slate-500 animate-pulse">Yuklanmoqda...</p>}

        {!loading && consultationId && studies.length === 0 && (
          <p className="text-slate-500">Bu konsultatsiyada DICOM/tasvir fayllar topilmadi.</p>
        )}

        <ul className="space-y-3">
          {studies.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileImage className="text-teal-600 shrink-0" size={20} />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{s.fileName}</p>
                  {s.aiSummary && <p className="text-xs text-violet-600 truncate">AI: {s.aiSummary}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openViewer(s.id)}
                className="btn-secondary !text-xs inline-flex items-center gap-1 shrink-0"
              >
                <ExternalLink size={14} /> Ko&apos;rish
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DashboardLayout>
  );
}
