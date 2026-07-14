'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import { ROLES_MT_DASHBOARD, ROLES_UT } from '@/lib/roles';

function isImageType(fileType: string, fileName: string) {
  if (fileType.startsWith('image/')) return true;
  const lower = fileName.toLowerCase();
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp');
}

function isDicomType(fileType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  return fileType === 'application/dicom' || lower.endsWith('.dcm') || lower.endsWith('.dicom');
}

async function renderDicomToCanvas(url: string, canvas: HTMLCanvasElement) {
  const dicomParser = await import('dicom-parser');
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const byteArray = new Uint8Array(buffer);
  const dataSet = dicomParser.parseDicom(byteArray);

  const rows = dataSet.uint16('x00280010') || 512;
  const columns = dataSet.uint16('x00280011') || 512;
  const bitsAllocated = dataSet.uint16('x00280100') || 8;
  const pixelRepresentation = dataSet.uint16('x00280103') || 0;
  const pixelDataElement = dataSet.elements.x7fe00010;
  if (!pixelDataElement) throw new Error('DICOM pixel ma\'lumoti topilmadi');

  const pixelData = new Uint8Array(
    byteArray.buffer,
    pixelDataElement.dataOffset,
    pixelDataElement.length,
  );

  canvas.width = columns;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.createImageData(columns, rows);
  let min = Infinity;
  let max = -Infinity;

  if (bitsAllocated === 8) {
    for (let i = 0; i < pixelData.length; i += 1) {
      const v = pixelData[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    for (let i = 0; i < pixelData.length && i < columns * rows; i += 1) {
      const normalized = max > min ? Math.round(((pixelData[i] - min) / (max - min)) * 255) : pixelData[i];
      const idx = i * 4;
      imageData.data[idx] = normalized;
      imageData.data[idx + 1] = normalized;
      imageData.data[idx + 2] = normalized;
      imageData.data[idx + 3] = 255;
    }
  } else {
    const view = pixelRepresentation === 1
      ? new Int16Array(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength / 2)
      : new Uint16Array(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength / 2);
    for (let i = 0; i < view.length; i += 1) {
      const v = view[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    for (let i = 0; i < view.length && i < columns * rows; i += 1) {
      const normalized = max > min ? Math.round(((view[i] - min) / (max - min)) * 255) : 128;
      const idx = i * 4;
      imageData.data[idx] = normalized;
      imageData.data[idx + 1] = normalized;
      imageData.data[idx + 2] = normalized;
      imageData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export default function DicomViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attachmentId = searchParams.get('attachmentId') || '';
  const { user, loading: authLoading } = useRequireAuth([...ROLES_MT_DASHBOARD, ...ROLES_UT]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fileName, setFileName] = useState('');
  const [viewerMode, setViewerMode] = useState<'loading' | 'image' | 'dicom' | 'error'>('loading');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user || !attachmentId) return;

    setViewerMode('loading');
    setError('');
    setImageUrl(null);

    api.getDicomViewerUrl(attachmentId)
      .then(async ({ url, fileName: name, fileType }) => {
        if (!url) throw new Error('Fayl havolasi mavjud emas');
        setFileName(name);

        if (isImageType(fileType || '', name)) {
          setImageUrl(url);
          setViewerMode('image');
          return;
        }

        if (isDicomType(fileType || '', name)) {
          setViewerMode('dicom');
          return;
        }

        setImageUrl(url);
        setViewerMode('image');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Ko\'rish xatosi');
        setViewerMode('error');
      });
  }, [authLoading, user, attachmentId]);

  useEffect(() => {
    if (viewerMode !== 'dicom' || !attachmentId || !canvasRef.current) return;

    api.getDicomViewerUrl(attachmentId)
      .then(async ({ url }) => {
        if (!url || !canvasRef.current) throw new Error('DICOM yuklanmadi');
        await renderDicomToCanvas(url, canvasRef.current);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'DICOM render xatosi');
        setViewerMode('error');
      });
  }, [viewerMode, attachmentId]);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary !p-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Tibbiy tasvir ko&apos;rish</h1>
            <p className="text-sm text-slate-600 truncate">{fileName || attachmentId}</p>
          </div>
        </div>

        {viewerMode === 'loading' && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="animate-spin" size={18} /> Yuklanmoqda...
          </div>
        )}
        {error && <p className="text-red-600">{error}</p>}

        <div className="panel p-4 bg-black flex items-center justify-center min-h-[420px] overflow-auto">
          {viewerMode === 'image' && imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={fileName} className="max-w-full max-h-[70vh] object-contain" />
          )}
          {viewerMode === 'dicom' && !error && (
            <canvas ref={canvasRef} className="max-w-full max-h-[70vh] object-contain" />
          )}
        </div>

        <p className="text-xs text-slate-500">
          DICOM fayllar brauzer ichida render qilinadi.
          {' '}
          <Link href="/dashboard/dicom" className="text-brand-600 hover:underline">Ro&apos;yxatga qaytish</Link>
        </p>
      </div>
    </DashboardLayout>
  );
}
