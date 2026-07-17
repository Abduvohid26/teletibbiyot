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
  const consultationRef = useRef(consultationId);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [error, setError] = useState('');

  consultationRef.current = consultationId;

  const stopAndUpload = useCallback(async (targetConsultationId?: string) => {
    const cid = targetConsultationId || consultationRef.current;
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive' || !cid) return;

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
            await api.uploadRecording(cid, blob);
            await api.completeRecording(cid, duration);
          } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
              setError(err instanceof Error ? err.message : 'Yozuv yuklashda xatolik');
            }
            try {
              await api.completeRecording(cid, duration);
            } catch {
              /* yozuv yakunlanmasa ham konsultatsiya davom etadi */
            }
          } finally {
            setUploading(false);
          }
        } else {
          try {
            await api.completeRecording(cid, duration);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Yozuvni yakunlashda xatolik');
          }
        }
        resolve();
      };
      recorder.stop();
    });
  }, []);

  const streamReady = !!(stream && stream.getVideoTracks().some((t) => t.readyState === 'live'));

  useEffect(() => {
    if (!enabled || !consultationId || !streamReady) return;
    if (startedRef.current) return;

    let cancelled = false;

    const start = async () => {
      try {
        const session = await api.tryStartRecording(consultationId);
        if (cancelled || startedRef.current) return;
        if (!session) {
          setSkipped(true);
          setRecording(false);
          return;
        }

        if (!stream) return;

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
    };
  }, [consultationId, enabled, streamReady, stream]);

  useEffect(() => {
    if (!consultationId) return;

    return () => {
      startedRef.current = false;
      if (recorderRef.current?.state !== 'inactive') {
        void stopAndUpload(consultationId);
      }
    };
  }, [consultationId, stopAndUpload]);

  useEffect(() => {
    if (!consultationId) return;
    const onEnd = () => { void stopAndUpload(consultationId); };
    window.addEventListener('call-ended-recording', onEnd);
    window.addEventListener('consultation-completed', onEnd);
    return () => {
      window.removeEventListener('call-ended-recording', onEnd);
      window.removeEventListener('consultation-completed', onEnd);
    };
  }, [consultationId, stopAndUpload]);

  return { recording, uploading, skipped, error };
}
