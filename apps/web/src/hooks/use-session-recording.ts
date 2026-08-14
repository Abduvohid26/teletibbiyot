'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n';

interface UseSessionRecordingOptions {
  consultationId?: string;
  stream: MediaStream | null;
  enabled?: boolean;
}

/** Tarmoq o'zgarganda (ERR_NETWORK_CHANGED) yozuv yuklashni bir necha marta
 *  qayta urinish — aks holda konsultatsiya yozuvi butunlay yo'qoladi. */
async function uploadWithRetry(cid: string, blob: Blob, attempts = 4): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await api.uploadRecording(cid, blob);
      return;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        // 1s, 2s, 4s — tarmoq barqarorlashishini kutamiz.
        await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
      }
    }
  }
  throw lastErr;
}

export function useSessionRecording({ consultationId, stream, enabled = true }: UseSessionRecordingOptions) {
  const { t } = useI18n();
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
            await uploadWithRetry(cid, blob);
            await api.completeRecording(cid, duration);
          } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
              setError(err instanceof Error ? err.message : t('recordingErrors.uploadFailed'));
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
            setError(err instanceof Error ? err.message : t('recordingErrors.completeFailed'));
          }
        }
        resolve();
      };
      recorder.stop();
    });
  }, [t]);

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
            setError(msg || t('recordingErrors.startFailed'));
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
  }, [consultationId, enabled, streamReady, stream, t]);

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
