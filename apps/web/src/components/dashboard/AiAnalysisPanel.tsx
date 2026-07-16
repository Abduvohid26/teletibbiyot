'use client';

import { useState } from 'react';
import { Brain, Send, RefreshCw, ThumbsUp, ThumbsDown, Sparkles, Download } from 'lucide-react';
import { AiAnalysis } from '@/lib/api';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { getAiAnalysisMeta } from '@/lib/ai-analysis-meta';
import { ClinicalConclusionReport } from '@/components/dashboard/ClinicalConclusionReport';

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
  const [downloading, setDownloading] = useState(false);
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
    setFeedbackError('');
    try {
      await api.analyzeConsultation(consultationId);
      onRefresh?.();
    } catch {
      setFeedbackError('AI qayta tahlil qilishda xatolik yuz berdi');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!consultationId) return;
    setDownloading(true);
    setFeedbackError('');
    try {
      await api.downloadAiAnalysisPdf(consultationId);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'PDF yuklab olishda xatolik');
    } finally {
      setDownloading(false);
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
          <span className={cn('panel-title', compact && 'text-xs')}>AI klinik xulosa</span>
        </div>
        <div className={cn('flex-1 overflow-hidden flex flex-col justify-center', compact ? 'p-2 gap-2' : 'p-3 gap-3')}>
          <div className="text-center space-y-2">
            <Brain className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-medium text-slate-600">
              {consultationId ? 'AI tahlil hali tayyor emas' : 'Faol konsultatsiya tanlang'}
            </p>
            <p className="text-[10px] text-slate-400">
              {consultationId
                ? 'Klinik ma\'lumotlar yuborilgach AI to\'liq xulosa tayyorlaydi'
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

  return (
    <div className="panel h-full flex flex-col overflow-hidden min-h-0">
      <div className={cn('panel-header bg-gradient-to-r from-violet-50/80 to-indigo-50/50 shrink-0', compact && 'py-1.5 px-2')}>
        <Sparkles size={compact ? 14 : 16} className="text-violet-600" />
        <span className={cn('panel-title', compact && 'text-xs')}>AI klinik xulosa</span>
        {consultationId && (
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={downloading}
            title="PDF yuklab olish"
            className="ml-1 p-1 rounded-lg hover:bg-white/60 text-violet-600"
          >
            <Download size={14} className={downloading ? 'animate-pulse' : ''} />
          </button>
        )}
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
      </div>

      <div className={cn('panel-body flex-1 min-h-0 overflow-y-auto', compact ? '!p-2' : 'p-3')}>
        {isUnavailable && (
          <div className={cn('rounded-xl border bg-red-50 border-red-200 mb-2', compact ? 'p-2' : 'p-3')}>
            <p className={cn('font-medium text-red-700', compact ? 'text-[10px]' : 'text-xs')}>
              AI xizmati mavjud emas — shifokor mustaqil klinik baholash o&apos;tkazishi kerak
            </p>
          </div>
        )}

        <ClinicalConclusionReport analysis={analysis} compact={compact} />

        {!feedbackSent && !compact && (
          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100">
            <span className="text-[10px] text-slate-400">Tahlil foydali bo&apos;ldimi?</span>
            <button type="button" onClick={() => handleFeedback('HELPFUL')} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><ThumbsUp size={14} /></button>
            <button type="button" onClick={() => handleFeedback('HARMFUL')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><ThumbsDown size={14} /></button>
          </div>
        )}
        {feedbackSent && (
          <p className="text-[10px] text-emerald-600 pt-2">Fikr-mulohaza yuborildi — rahmat!</p>
        )}
        {feedbackError && (
          <p className="text-[10px] text-red-600 pt-1">{feedbackError}</p>
        )}
      </div>

      <div className={cn('border-t border-slate-100 bg-slate-50/50 shrink-0', compact ? 'p-2' : 'p-3')}>
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
          <div className="mt-1.5 p-2 bg-white rounded-lg border border-slate-100 text-[10px] text-slate-600 max-h-24 overflow-y-auto leading-relaxed">
            {chatResponse}
          </div>
        )}
      </div>
    </div>
  );
}
