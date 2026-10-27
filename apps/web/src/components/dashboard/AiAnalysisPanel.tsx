'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Brain, Send, RefreshCw, ThumbsUp, ThumbsDown, Sparkles, MessageCircle, Loader2, CloudOff } from 'lucide-react';
import { AiAnalysis, AiAnalysisStep } from '@/lib/api';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getAiAnalysisMeta } from '@/lib/ai-analysis-meta';
import { ClinicalConclusionReport } from '@/components/dashboard/ClinicalConclusionReport';
import { AiChatMessage } from '@/components/dashboard/AiChatMessage';
import { PdfDownloadButton } from '@/components/dashboard/PdfDownloadButton';
import { useAnalysisTranslation } from '@/hooks/use-analysis-translation';
import { useI18n } from '@/i18n';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface AiAnalysisPanelProps {
  analysis?: AiAnalysis;
  consultationId?: string;
  /** AI tahlil bosqichlari — "xulosa qilinmoqda" holatini shundan bilamiz */
  steps?: AiAnalysisStep[];
  onRefresh?: () => void;
  compact?: boolean;
}

/** Tahlil hali ishlayaptimi: bosqichlar bor, lekin hammasi tugamagan */
function isAnalysisRunning(steps?: AiAnalysisStep[]) {
  if (!steps?.length) return false;
  return steps.some((s) => s.status !== 'DONE' && s.status !== 'FAILED');
}

const SUGGESTED_QUESTION_KEYS = [
  'clinical.suggestAlt',
  'clinical.suggestTests',
  'clinical.suggestMeds',
  'clinical.suggestDiet',
  'clinical.suggestPrognosis',
] as const;

export function AiAnalysisPanel({ analysis, consultationId, steps, onRefresh, compact }: AiAnalysisPanelProps) {
  const { t } = useI18n();
  const [question, setQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Til almashsa xulosa avtomatik o'sha tilga o'giriladi
  const {
    analysis: localizedAnalysis,
    translating,
    failed: translationFailed,
    retry: retryTranslation,
  } = useAnalysisTranslation(analysis, consultationId, onRefresh);

  const running = analyzing || (!analysis && isAnalysisRunning(steps));
  const stepProgress = useMemo(() => {
    const list = steps ?? [];
    const done = list.filter((s) => s.status === 'DONE').length;
    const current = list.find((s) => s.status === 'IN_PROGRESS');
    return { done, total: list.length, current };
  }, [steps]);

  // Tahlil fonda davom etayotgan bo'lsa — tayyor bo'lgani bilan o'zi ko'rinsin
  useEffect(() => {
    if (analysis || !consultationId || !onRefresh) return;
    if (!isAnalysisRunning(steps) && !analyzing) return;
    const timer = setInterval(() => onRefresh(), 5000);
    return () => clearInterval(timer);
  }, [analysis, consultationId, onRefresh, steps, analyzing]);

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
      const answer = res.aiUnavailable || !res.answer ? t('clinical.chatUnavailable') : res.answer;
      setChatMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', text: t('clinical.chatError') }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!consultationId) return;
    setAnalyzing(true);
    setFeedbackError('');
    try {
      const res = (await api.analyzeConsultation(consultationId)) as { aiUnavailable?: boolean } | undefined;
      onRefresh?.();
      if (res?.aiUnavailable) {
        toast.warning(t('clinical.unavailableTitle'), { description: t('clinical.unavailableNext') });
      }
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
        <div className="glass-header shrink-0 bg-gradient-to-r from-gold-400/10 to-brand-500/10 py-2 px-3">
          <Sparkles size={16} className="text-gold-700" />
          <span className="panel-title text-sm">{t('clinical.title')}</span>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col justify-center p-4 gap-3">
          {running ? (
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gold-50 ring-1 ring-gold-200/70 flex items-center justify-center mx-auto">
                <Loader2 className="w-6 h-6 text-gold-700 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-gold-700">{t('clinical.inProgressTitle')}</p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                {t('clinical.inProgressHint')}
              </p>
              {stepProgress.total > 0 && (
                <div className="max-w-xs mx-auto space-y-1.5 pt-1">
                  <div className="h-1.5 rounded-full bg-gold-100 overflow-hidden">
                    <div
                      className="h-full bg-gold-400 transition-all duration-500"
                      style={{ width: `${Math.round((stepProgress.done / stepProgress.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {t('clinical.inProgressCount', { done: stepProgress.done, total: stepProgress.total })}
                    {stepProgress.current
                      ? ` · ${t('clinical.inProgressStep', { label: stepProgress.current.label })}`
                      : ''}
                  </p>
                </div>
              )}
            </div>
          ) : (
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
          )}
          {feedbackError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 text-center">{feedbackError}</p>
          )}
          {consultationId && !running && (
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

  const { isUnavailable, unavailableReason } = getAiAnalysisMeta(analysis);

  return (
    <div className="panel h-full flex flex-col overflow-hidden min-h-0">
      <div className="panel-header bg-gradient-to-r from-gold-50/80 to-brand-50/50 shrink-0 py-2 px-3 gap-2">
        <Sparkles size={16} className="text-gold-700 shrink-0" />
        <span className="panel-title text-sm flex-1 min-w-0 truncate">{t('clinical.title')}</span>
        {translating && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gold-700 bg-gold-100/80 px-1.5 py-0.5 rounded-full shrink-0">
            <Loader2 size={10} className="animate-spin" />
            {t('clinical.translatingTitle')}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {consultationId && !isUnavailable && (
            <PdfDownloadButton consultationId={consultationId} onError={setFeedbackError} />
          )}
          {consultationId && (
            <button
              type="button"
              onClick={() => void handleReanalyze()}
              disabled={analyzing}
              title={t('clinical.reanalyze')}
              className="p-1.5 rounded-lg hover:bg-white/60 text-gold-700"
            >
              <RefreshCw size={14} className={analyzing ? 'animate-spin' : ''} />
            </button>
          )}
          {!isUnavailable && (
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            title={t('clinical.chat')}
            className={cn(
              'p-1.5 rounded-lg text-gold-700',
              chatOpen ? 'bg-gold-100' : 'hover:bg-white/60',
            )}
          >
            <MessageCircle size={14} />
          </button>
          )}
        </div>
      </div>

      {isUnavailable && analyzing ? (
        <div className="panel-body flex-1 min-h-0 p-4 flex flex-col items-center justify-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-gold-50 ring-1 ring-gold-200/70 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-gold-700 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-gold-700">{t('clinical.inProgressTitle')}</p>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs">{t('clinical.inProgressHint')}</p>
        </div>
      ) : isUnavailable ? (
        <div className="panel-body flex-1 min-h-0 overflow-y-auto p-4 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center">
            <CloudOff className="w-6 h-6 text-amber-600" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <p className="text-sm font-semibold text-slate-800">{t('clinical.unavailableTitle')}</p>
            <p className="text-xs text-slate-600 leading-relaxed">{t('clinical.unavailableBody')}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{t('clinical.unavailableNext')}</p>
          </div>
          {unavailableReason && (
            <p className="text-[10px] text-slate-400">
              {t('clinical.unavailableReason', {
                reason: t(`clinical.reason_${unavailableReason}`),
              })}
            </p>
          )}
          {consultationId && (
            <button
              type="button"
              onClick={() => void handleReanalyze()}
              disabled={analyzing}
              className="btn-secondary text-xs inline-flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={14} className={analyzing ? 'animate-spin' : ''} />
              {analyzing ? t('clinical.analyzing') : t('clinical.retryAnalysis')}
            </button>
          )}
          {feedbackError && <p className="text-xs text-red-600">{feedbackError}</p>}
        </div>
      ) : (
      <div className="panel-body flex-1 min-h-0 overflow-y-auto p-3">
        <ClinicalConclusionReport
          analysis={localizedAnalysis ?? analysis}
          compact={compact}
          expanded
          onRequestTranslation={consultationId ? retryTranslation : undefined}
          translating={translating}
          translationFailed={translationFailed}
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
      )}

      {chatOpen && !isUnavailable && (
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
                        className="text-[10px] px-2 py-1 rounded-full bg-white border border-gold-200 text-gold-700 hover:bg-gold-50"
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
