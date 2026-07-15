'use client';

import { useState } from 'react';
import { Brain, AlertTriangle, Send, CheckCircle2, Sparkles, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { AiAnalysis } from '@/lib/api';
import { formatTriage, cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { getAiAnalysisMeta } from '@/lib/ai-analysis-meta';

interface AiAnalysisPanelProps {
  analysis?: AiAnalysis;
  consultationId?: string;
  onRefresh?: () => void;
  compact?: boolean;
}

export function AiAnalysisPanel({ analysis, consultationId, onRefresh, compact }: AiAnalysisPanelProps) {
  const [question, setQuestion] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  const handleAsk = async () => {
    if (!question.trim() || !consultationId) return;
    setLoading(true);
    try {
      const res = await api.aiChat(consultationId, question);
      setChatResponse(res.answer);
    } catch {
      setChatResponse('Javob olishda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!consultationId) return;
    setAnalyzing(true);
    try {
      await api.analyzeConsultation(consultationId);
      onRefresh?.();
    } catch {
      setFeedbackError('AI qayta tahlil qilishda xatolik yuz berdi');
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
      setFeedbackError(err instanceof Error ? err.message : 'Fikr yuborishda xatolik');
    }
  };

  if (!analysis) {
    return (
      <div className="glass-panel h-full flex flex-col overflow-hidden min-h-0">
        <div className={cn('glass-header shrink-0 bg-gradient-to-r from-violet-500/10 to-indigo-500/10', compact && 'py-1.5 px-2')}>
          <Sparkles size={compact ? 14 : 16} className="text-violet-600" />
          <span className={cn('panel-title', compact && 'text-xs')}>AI dastlabki tahlil</span>
        </div>
        <div className={cn('flex-1 overflow-hidden flex flex-col justify-center', compact ? 'p-2 gap-2' : 'p-3 gap-3')}>
          <div className="text-center space-y-2">
            <Brain className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-medium text-slate-600">
              {consultationId ? 'AI tahlil hali tayyor emas' : 'Faol konsultatsiya tanlang'}
            </p>
            <p className="text-[10px] text-slate-400">
              {consultationId
                ? 'Klinik ma\'lumotlar yuborilgach AI tahlil boshlanadi yoki qo\'lda ishga tushiring'
                : 'Navbatdan konsultatsiyani boshlang'}
            </p>
          </div>

          {feedbackError && (
            <p className="text-[10px] text-red-600 bg-red-50 rounded-lg p-2 text-center">{feedbackError}</p>
          )}

          {consultationId && (
            <button
              type="button"
              onClick={handleReanalyze}
              disabled={analyzing}
              className="btn-secondary !text-[10px] inline-flex items-center justify-center gap-1.5 w-full"
            >
              <RefreshCw size={12} className={analyzing ? 'animate-spin' : ''} />
              {analyzing ? 'Tahlil qilinmoqda...' : 'AI tahlilni boshlash'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const { isUnavailable } = getAiAnalysisMeta(analysis);

  const topDiagnosis = analysis.diagnoses[0];
  const triage = formatTriage(analysis.triageLevel);

  return (
    <div className="panel h-full flex flex-col overflow-hidden min-h-0">
      <div className={cn('panel-header bg-gradient-to-r from-violet-50/80 to-indigo-50/50 shrink-0', compact && 'py-1.5 px-2')}>
        <Sparkles size={compact ? 14 : 16} className="text-violet-600" />
        <span className={cn('panel-title', compact && 'text-xs')}>AI dastlabki tahlil</span>
        {consultationId && (
          <button
            type="button"
            onClick={handleReanalyze}
            disabled={analyzing}
            title="Qayta tahlil"
            className="ml-1 p-1 rounded-lg hover:bg-white/60 text-violet-600"
          >
            <RefreshCw size={14} className={analyzing ? 'animate-spin' : ''} />
          </button>
        )}
        <span className={cn('ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full', triage.color, 'bg-white/80')}>
          {triage.label} xavf
        </span>
      </div>

      <div className={cn('panel-body flex-1 overflow-hidden', compact ? 'space-y-2 !p-2' : 'overflow-y-auto space-y-4')}>
        {!compact && (
        <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200/80">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Bu faqat AI tavsiyasi. Yakuniy tibbiy qaror faqat malakali shifokorga tegishli.
          </p>
        </div>
        )}

        {(isUnavailable) && (
          <div className={cn('rounded-xl border bg-red-50 border-red-200', compact ? 'p-2' : 'p-3')}>
            <p className={cn('font-medium text-red-700', compact ? 'text-[10px]' : 'text-xs')}>
              AI xizmati mavjud emas — shifokor mustaqil klinik baholash o&apos;tkazishi kerak
            </p>
          </div>
        )}

        {topDiagnosis && (
          <div className={cn('rounded-xl glass-preview-card', compact ? 'p-2' : 'p-4')}>
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Tashxis</p>
            <p className={cn('font-bold text-slate-900 leading-tight', compact ? 'text-xs' : 'text-base')}>
              {topDiagnosis.name}
              <span className="text-slate-500 font-normal ml-1">({topDiagnosis.icd10Code})</span>
            </p>
            <div className={cn(compact ? 'mt-1.5' : 'mt-3')}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-500">Ishonch</span>
                <span className="font-bold text-brand-600">{topDiagnosis.confidence}%</span>
              </div>
              <div className="h-2 bg-white/40 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full rounded-full animate-gradient-shift"
                  style={{
                    width: `${topDiagnosis.confidence}%`,
                    background: 'linear-gradient(90deg, #2563eb, #6366f1, #8b5cf6, #6366f1)',
                    backgroundSize: '200% 100%',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {analysis.summary && (
          <div className={cn('rounded-xl bg-slate-50 border border-slate-100', compact ? 'p-2' : 'p-3')}>
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Xulosa</p>
            <p className={cn('text-slate-600 leading-relaxed whitespace-pre-line', compact ? 'text-[10px] line-clamp-4' : 'text-xs')}>
              {analysis.summary}
            </p>
          </div>
        )}

        <div>
          <ul className="space-y-1">
            {analysis.recommendations.slice(0, compact ? 2 : undefined).map((rec, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-700">
                <CheckCircle2 size={11} className="text-emerald-500 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {analysis.redFlags.length > 0 && !compact && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-xs font-bold text-red-700 mb-1.5">⚠ Qizil bayroqlar</p>
            {analysis.redFlags.map((flag, i) => (
              <p key={i} className="text-[11px] text-red-600 leading-relaxed">{flag}</p>
            ))}
          </div>
        )}

        {!feedbackSent && !compact && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-slate-400">Tahlil foydali bo&apos;ldimi?</span>
            <button type="button" onClick={() => handleFeedback('HELPFUL')} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><ThumbsUp size={14} /></button>
            <button type="button" onClick={() => handleFeedback('HARMFUL')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><ThumbsDown size={14} /></button>
          </div>
        )}
        {feedbackSent && (
          <p className="text-[10px] text-emerald-600">Fikr-mulohaza yuborildi — rahmat!</p>
        )}
        {feedbackError && (
          <p className="text-[10px] text-red-600">{feedbackError}</p>
        )}
      </div>

      <div className={cn('border-t border-slate-100 bg-slate-50/50', compact ? 'p-2' : 'p-4')}>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="AI ga savol..."
            className="input flex-1 !py-1.5 !text-[10px]"
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={loading}
            className="p-1.5 gradient-btn rounded-lg disabled:opacity-50 shrink-0"
          >
            <Send size={12} />
          </button>
        </div>
        {chatResponse && (
          <div className="mt-1.5 p-2 bg-white rounded-lg border border-slate-100 text-[10px] text-slate-600 line-clamp-2 leading-relaxed">
            {chatResponse}
          </div>
        )}
      </div>
    </div>
  );
}
