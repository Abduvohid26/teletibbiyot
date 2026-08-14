'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api, ConsultationMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useConsultationRealtime } from '@/hooks/use-consultation-realtime';
import { toast } from '@/lib/toast';
import { Send, Bot, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

export function ChatTranscript({ consultationId, compact }: { consultationId?: string; compact?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!consultationId) return;
    api.getConsultationMessages(consultationId)
      .then(setMessages)
      .catch((err) => toast(err instanceof Error ? err.message : t('chat.loadError'), 'error'));
  }, [consultationId, t]);

  useConsultationRealtime(consultationId ? [consultationId] : [], {
    onChatMessagePersisted: () => load(),
  });

  useEffect(() => {
    if (!consultationId) {
      setMessages([]);
      return;
    }
    load();
  }, [load, consultationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !consultationId) return;
    setSending(true);
    try {
      const msg = await api.sendConsultationMessage(consultationId, text.trim());
      setMessages((prev) => [...prev, msg]);
      setText('');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('chat.sendError'), 'error');
    } finally {
      setSending(false);
    }
  };

  const displayMessages = consultationId && messages.length > 0
    ? messages
    : null;

  const systemHints = [
    t('chat.hint1'),
    t('chat.hint2'),
    t('chat.hint3'),
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={cn('flex-1 overflow-y-auto space-y-1.5 pr-0.5', compact ? 'max-h-none' : 'max-h-48')}>
        {!displayMessages ? (
          <div className="space-y-1.5">
            {systemHints.map((hint) => (
              <div key={hint} className="flex items-start gap-2 glass-preview-card !p-2">
                <Bot size={12} className="text-violet-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-relaxed">{hint}</p>
              </div>
            ))}
            <div className="flex items-start gap-2 glass-preview-card !p-2 opacity-70">
              <Stethoscope size={12} className="text-brand-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="shimmer-line w-full !h-2" />
                <div className="shimmer-line w-2/3 !h-2" />
              </div>
            </div>
          </div>
        ) : (
          displayMessages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'text-[10px] rounded-lg px-2 py-1.5 max-w-[92%] backdrop-blur-sm',
                m.sender.id === user?.id
                  ? 'ml-auto bg-brand-500/15 text-brand-900 border border-brand-200/40'
                  : 'bg-white/40 text-slate-800 border border-white/50',
              )}
            >
              <p className="font-medium text-[9px] opacity-70">{m.sender.fullName}</p>
              <p>{m.message}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-1.5 mt-1.5 pt-1.5 border-t border-white/30 shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={consultationId ? t('chat.placeholder') : t('chat.needConsultation')}
          disabled={!consultationId}
          className={cn(
            'flex-1 rounded-lg px-2 py-1.5 text-[10px] transition-all',
            'bg-white/40 backdrop-blur-sm border border-white/50',
            'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            'disabled:opacity-50',
          )}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !consultationId}
          className="p-1.5 gradient-btn rounded-lg disabled:opacity-40 shrink-0"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
