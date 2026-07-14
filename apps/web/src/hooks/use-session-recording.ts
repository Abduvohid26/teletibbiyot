'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface UseSessionRecordingOptions {
  consultationId?: string;
  stream: MediaStream | null;
  enabled?: boolean;
}

export function useSessionRecording({ consultationId, stream, enabled = true }: UseSessionRecordingOptions) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(false);
  const startTimeRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [error, setError] = useState('');

  const stopAndUpload = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive' || !consultationId) return;

    await new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        chunksRef.current = [];
        recorderRef.current = null;
        startedRef.current = false;
        setRecording(false);

        if (blob.size > 0) {
          setUploading(true);
          try {
            await api.uploadRecording(consultationId, blob);
            await api.completeRecording(consultationId, duration);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Yozuv yuklashda xatolik');
          } finally {
            setUploading(false);
          }
        } else {
          try {
            await api.completeRecording(consultationId, duration);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Yozuvni yakunlashda xatolik');
          }
        }
        resolve();
      };
      recorder.stop();
    });
  }, [consultationId]);

  useEffect(() => {
    if (!enabled || !consultationId || !stream || stream.getTracks().length === 0) return;
    if (startedRef.current) return;

    let cancelled = false;

    const start = async () => {
      try {
        const session = await api.tryStartRecording(consultationId);
        if (cancelled) return;
        if (!session) {
          setSkipped(true);
          setRecording(false);
          return;
        }

        setSkipped(false);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : '';

        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.start(5000);
        recorderRef.current = recorder;
        startTimeRef.current = Date.now();
        startedRef.current = true;
        setRecording(true);
        setError('');
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : '';
          if (!msg.includes('rozilik')) {
            setError(msg || 'Yozuvni boshlashda xatolik');
          } else {
            setSkipped(true);
          }
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (recorderRef.current?.state !== 'inactive') {
        void stopAndUpload();
      }
    };
  }, [consultationId, stream, enabled, stopAndUpload]);

  useEffect(() => {
    if (!consultationId) return;
    const onEnd = () => { void stopAndUpload(); };
    window.addEventListener('call-ended-recording', onEnd);
    window.addEventListener('consultation-completed', onEnd);
    return () => {
      window.removeEventListener('call-ended-recording', onEnd);
      window.removeEventListener('consultation-completed', onEnd);
    };
  }, [consultationId, stopAndUpload]);

  return { recording, uploading, skipped, error };
}
