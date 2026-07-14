'use client';

import { useEffect, useRef } from 'react';
import { Attachment } from '@/lib/api';
import {
  acquireStaffFeedSocket,
  acquireVideoSocketRooms,
  releaseStaffFeedSocket,
  releaseVideoSocketRooms,
} from '@/lib/video-socket-client';
import { toast } from '@/lib/toast';

export interface ConsultationRealtimeHandlers {
  onAttachmentUploaded?: (attachment: Attachment, consultationId: string) => void;
  onAttachmentAnalyzed?: (attachment: Attachment, consultationId: string) => void;
  onConsultationStarted?: (payload: { consultationId: string; doctorName?: string }) => void;
  onConsultationCompleted?: (payload: { consultationId: string }) => void;
  onAiUpdated?: (consultationId: string) => void;
  onChatMessagePersisted?: (consultationId: string) => void;
  onTriageUpdated?: (consultationId: string) => void;
  onPriorityUpdated?: (consultationId: string) => void;
}

type RealtimePayload = {
  consultationId?: string;
  doctorName?: string;
  fileName?: string;
  aiSummary?: string;
} & Partial<Attachment>;

function resolveConsultationId(payload: RealtimePayload, fallback: string): string {
  return payload.consultationId || fallback;
}

function matchesSubscription(cid: string, ids: string[], staffFeed: boolean): boolean {
  if (!cid) return false;
  if (staffFeed) return true;
  return ids.includes(cid);
}

/** Bir umumiy socket orqali bir nechta konsultatsiyani yoki staff feed orqali kuzatish */
export function useConsultationRealtime(
  consultationIds: string[],
  handlers: ConsultationRealtimeHandlers,
  options?: { notifyToasts?: boolean; staffFeed?: boolean; enabled?: boolean },
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const idsKey = consultationIds.filter(Boolean).join(',');
  const staffFeed = options?.staffFeed ?? false;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    if (!staffFeed && !consultationIds.filter(Boolean).length) return;

    const ids = [...new Set(consultationIds.filter(Boolean))];
    const socket = staffFeed ? acquireStaffFeedSocket() : acquireVideoSocketRooms(ids);

    const onUploaded = (payload: RealtimePayload) => {
      const cid = resolveConsultationId(payload, '');
      if (!matchesSubscription(cid, ids, staffFeed)) return;
      const attachment = payload as Attachment;
      handlersRef.current.onAttachmentUploaded?.(attachment, cid);
      if (options?.notifyToasts && attachment.fileName) {
        toast(`Yangi hujjat: ${attachment.fileName}`, 'info');
      }
      window.dispatchEvent(
        new CustomEvent('attachment-uploaded', { detail: { consultationId: cid, attachment } }),
      );
    };

    const onAnalyzed = (payload: RealtimePayload) => {
      const cid = resolveConsultationId(payload, '');
      if (!matchesSubscription(cid, ids, staffFeed)) return;
      const attachment = payload as Attachment;
      handlersRef.current.onAttachmentAnalyzed?.(attachment, cid);
      if (options?.notifyToasts && attachment.aiSummary) {
        toast(`AI tahlil: ${attachment.fileName}`, 'success');
      }
      window.dispatchEvent(
        new CustomEvent('attachment-analyzed', { detail: { consultationId: cid, attachment } }),
      );
      handlersRef.current.onAiUpdated?.(cid);
    };

    const onStarted = (payload: RealtimePayload) => {
      const cid = resolveConsultationId(payload, '');
      if (!matchesSubscription(cid, ids, staffFeed)) return;
      handlersRef.current.onConsultationStarted?.({
        consultationId: cid,
        doctorName: payload.doctorName,
      });
      window.dispatchEvent(new CustomEvent('consultation-started', { detail: payload }));
    };

    const onCompleted = (payload: RealtimePayload) => {
      const cid = resolveConsultationId(payload, '');
      if (!matchesSubscription(cid, ids, staffFeed)) return;
      handlersRef.current.onConsultationCompleted?.({ consultationId: cid });
      window.dispatchEvent(new CustomEvent('consultation-completed', { detail: payload }));
    };

    const onAiUpdated = (payload: RealtimePayload) => {
      const cid = resolveConsultationId(payload, '');
      if (!matchesSubscription(cid, ids, staffFeed)) return;
      handlersRef.current.onAiUpdated?.(cid);
    };

    const onChatPersisted = (payload: RealtimePayload) => {
      const cid = resolveConsultationId(payload, '');
      if (!matchesSubscription(cid, ids, staffFeed)) return;
      handlersRef.current.onChatMessagePersisted?.(cid);
    };

    const onTriageUpdated = (payload: RealtimePayload) => {
      const cid = resolveConsultationId(payload, '');
      if (!matchesSubscription(cid, ids, staffFeed)) return;
      handlersRef.current.onTriageUpdated?.(cid);
    };

    const onPriorityUpdated = (payload: RealtimePayload) => {
      const cid = resolveConsultationId(payload, '');
      if (!matchesSubscription(cid, ids, staffFeed)) return;
      handlersRef.current.onPriorityUpdated?.(cid);
    };

    socket.on('attachment-uploaded', onUploaded);
    socket.on('attachment-analyzed', onAnalyzed);
    socket.on('consultation-started', onStarted);
    socket.on('consultation-completed', onCompleted);
    socket.on('ai-analysis-updated', onAiUpdated);
    socket.on('chat-message-persisted', onChatPersisted);
    socket.on('triage-updated', onTriageUpdated);
    socket.on('priority-updated', onPriorityUpdated);

    return () => {
      socket.off('attachment-uploaded', onUploaded);
      socket.off('attachment-analyzed', onAnalyzed);
      socket.off('consultation-started', onStarted);
      socket.off('consultation-completed', onCompleted);
      socket.off('ai-analysis-updated', onAiUpdated);
      socket.off('chat-message-persisted', onChatPersisted);
      socket.off('triage-updated', onTriageUpdated);
      socket.off('priority-updated', onPriorityUpdated);

      if (staffFeed) {
        releaseStaffFeedSocket();
      } else {
        releaseVideoSocketRooms(ids);
      }
    };
  }, [idsKey, options?.notifyToasts, staffFeed, enabled]);
}
