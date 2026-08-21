'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Brain, Send, RefreshCw, ThumbsUp, ThumbsDown, Sparkles, MessageCircle } from 'lucide-react';
import { AiAnalysis } from '@/lib/api';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { getAiAnalysisMeta } from '@/lib/ai-analysis-meta';
import { toast } from '@/lib/toast';
import { ClinicalConclusionReport } from '@/components/dashboard/ClinicalConclusionReport';
import { AiChatMessage } from '@/components/dashboard/AiChatMessage';
import { PdfDownloadButton } from '@/components/dashboard/PdfDownloadButton';
import { useI18n } from '@/i18n';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface AiAnalysisPanelProps {
  analysis?: AiAnalysis;
  consultationId?: string;
  onRefresh?: () => void;
  compact?: boolean;
}

const SUGGESTED_QUESTION_KEYS = [
  'clinical.suggestAlt',
  'clinical.suggestTests',
  'clinical.suggestMeds',
  'clinical.suggestDiet',
  'clinical.suggestPrognosis',
] as const;

export function AiAnalysisPanel({ analysis, consultationId, onRefresh, compact }: AiAnalysisPanelProps) {
  const { t, locale } = useI18n();
  const [question, setQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const [translating, setTranslating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatMessages([]);
  }, [consultationId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loading]);

  const handleAsk = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text || !consultationId || loading) return;
    setQuestion('');
    setChatMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    setChatOpen(true);
    try {
      const res = await api.aiChat(consultationId, text);
      setChatMessages((prev) => [...prev, { role: 'assistant', text: res.answer }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', text: t('clinical.chatError') }]);
    } finally {
      setLoading(false);
    }
  };

  // Interfeys tilida tarjima yo'q bo'lsa — serverdan so'raymiz, keyin qayta yuklaymiz
  const handleTranslate = useCallback(async () => {
    if (!consultationId || translating) return;
    setTranslating(true);
    try {
      await api.localizeAnalysis(consultationId);
      onRefresh?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('errors.generic'), 'error');
    } finally {
      setTranslating(false);
    }
  }, [consultationId, translating, onRefresh, t]);

  const handleReanalyze = async () => {
    if (!consultationId) return;
    setAnalyzing(true);
    setFeedbackError('');
    try {
      await api.analyzeConsultation(consultationId);
      onRefresh?.();
    } catch {
      setFeedbackError(t('clinical.reanalyzeError'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFeedback = async (rating: 'HELPFUL' | 'HARMFUL') => {
    if (!analysis?.id) return;
    setFeedbackError('');
    try {
      await api.submitAiFeedback(analysis.id, rating);
      setFeedbackSent(true);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : t('clinical.feedbackError'));
    }
  };

  if (!analysis) {
    return (
      <div className="glass-panel h-full flex flex-col overflow-hidden min-h-0">
        <div className="glass-header shrink-0 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 py-2 px-3">
          <Sparkles size={16} className="text-violet-600" />
          <span className="panel-title text-sm">{t('clinical.title')}</span>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col justify-center p-4 gap-3">
          <div className="text-center space-y-2">
            <Brain className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-600">
              {consultationId ? t('clinical.notReadyYet') : t('clinical.selectConsultation')}
            </p>
            <p className="text-xs text-slate-400">
              {consultationId
                ? t('clinical.fullReport')
                : t('clinical.startFromQueue')}
            </p>
          </div>
          {feedbackError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 text-center">{feedbackError}</p>
          )}
          {consultationId && (
            <button
              type="button"
              onClick={() => void handleReanalyze()}
              disabled={analyzing}
              className="btn-secondary text-xs inline-flex items-center justify-center gap-1.5 w-full"
            >
              <RefreshCw size={14} className={analyzing ? 'animate-spin' : ''} />
              {analyzing ? t('clinical.analyzing') : t('clinical.startAnalysis')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const { isUnavailable } = getAiAnalysisMeta(analysis);

  return (
    <div className="panel h-full flex flex-col overflow-hidden min-h-0">
      <div className="panel-header bg-gradient-to-r from-violet-50/80 to-indigo-50/50 shrink-0 py-2 px-3 gap-2">
        <Sparkles size={16} className="text-violet-600 shrink-0" />
        <span className="panel-title text-sm flex-1 min-w-0 truncate">{t('clinical.title')}</span>
        <div className="flex items-center gap-1 shrink-0">
          {consultationId && (
            <PdfDownloadButton consultationId={consultationId} onError={setFeedbackError} />
          )}
          {consultationId && (
            <button
              type="button"
              onClick={() => void handleReanalyze()}
              disabled={analyzing}
              title={t('clinical.reanalyze')}
              className="p-1.5 rounded-lg hover:bg-white/60 text-violet-600"
            >
              <RefreshCw size={14} className={analyzing ? 'animate-spin' : ''} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            title={t('clinical.chat')}
            className={cn(
              'p-1.5 rounded-lg text-violet-600',
              chatOpen ? 'bg-violet-100' : 'hover:bg-white/60',
            )}
          >
            <MessageCircle size={14} />
          </button>
        </div>
      </div>

      <div className="panel-body flex-1 min-h-0 overflow-y-auto p-3">
        {isUnavailable && (
          <div className="rounded-xl border bg-red-50 border-red-200 mb-3 p-3">
            <p className="text-xs font-medium text-red-700">
              {t('clinical.unavailable')}
            </p>
          </div>
        )}

        <ClinicalConclusionReport
          analysis={analysis}
          compact={compact}
          expanded
          onRequestTranslation={consultationId ? handleTranslate : undefined}
          translating={translating}
        />

        {!feedbackSent && (
          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">{t('clinical.helpfulQuestion')}</span>
            <button type="button" onClick={() => void handleFeedback('HELPFUL')} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><ThumbsUp size={14} /></button>
            <button type="button" onClick={() => void handleFeedback('HARMFUL')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><ThumbsDown size={14} /></button>
          </div>
        )}
        {feedbackSent && (
          <p className="text-xs text-emerald-600 pt-2">{t('clinical.feedbackThanks')}</p>
        )}
        {feedbackError && (
          <p className="text-xs text-red-600 pt-1">{feedbackError}</p>
        )}
      </div>

      {chatOpen && (
        <div className="border-t border-slate-200 bg-slate-50/80 shrink-0 flex flex-col max-h-[60%] min-h-[180px]">
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
            {chatMessages.length === 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 px-1">{t('clinical.askAi')}</p>
                <div className="flex flex-wrap gap-1">
                  {SUGGESTED_QUESTION_KEYS.map((key) => {
                    const sq = t(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => void handleAsk(sq)}
                        className="text-[10px] px-2 py-1 rounded-full bg-white border border-violet-200 text-violet-700 hover:bg-violet-50"
                      >
                        {sq}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'ml-auto max-w-[85%] bg-brand-600 text-white'
                    : 'mr-auto w-full bg-white border border-slate-200 text-slate-700 shadow-sm',
                )}
              >
                <AiChatMessage text={msg.text} role={msg.role} />
              </div>
            ))}
            {loading && (
              <p className="text-xs text-slate-400 animate-pulse px-1">{t('clinical.preparingAnswer')}</p>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2 border-t border-slate-200 shrink-0">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleAsk()}
                placeholder={t('clinical.askPlaceholder')}
                className="input flex-1 !py-2 !text-xs"
              />
              <button
                type="button"
                onClick={() => void handleAsk()}
                disabled={loading || !question.trim()}
                className="p-2 gradient-btn rounded-lg disabled:opacity-50 shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
