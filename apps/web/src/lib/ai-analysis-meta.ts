import { AiAnalysis } from '@/lib/api';

type AiRawResponse = {
  source?: string;
  aiUnavailable?: boolean;
};

export function getAiAnalysisMeta(analysis?: AiAnalysis) {
  const raw = analysis?.rawResponse as AiRawResponse | undefined;
  return {
    isMock: raw?.source === 'mock',
    isUnavailable: raw?.aiUnavailable === true,
  };
}
