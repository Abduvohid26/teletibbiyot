import { AiAnalysis } from '@/lib/api';

type AiRawResponse = {
  source?: string;
  aiUnavailable?: boolean;
};

export function getAiAnalysisMeta(analysis?: AiAnalysis) {
  const raw = analysis?.rawResponse as AiRawResponse | undefined;
  const legacyMock = raw?.source === 'mock';
  return {
    isMock: legacyMock,
    isUnavailable: raw?.aiUnavailable === true || legacyMock,
  };
}
