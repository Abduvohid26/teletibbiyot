import { AiAnalysis } from '@/lib/api';

type AiRawResponse = {
  source?: string;
  aiUnavailable?: boolean;
  /** AI nima sababdan ishlamadi (not_configured, auth, quota, network, ...) */
  reason?: string;
  clinicalConclusion?: { consensusDiagnoses?: Array<{ name?: string }> };
};

export function getAiAnalysisMeta(analysis?: AiAnalysis) {
  const raw = analysis?.rawResponse as AiRawResponse | undefined;
  const legacyMock = raw?.source === 'mock';
  const isUnavailable = raw?.aiUnavailable === true || legacyMock;
  const hasDiagnosis =
    !isUnavailable
    && (Boolean(raw?.clinicalConclusion?.consensusDiagnoses?.some((d) => d.name?.trim()))
      || Boolean(analysis?.diagnoses?.some((d) => d.name?.trim())));
  return {
    isMock: legacyMock,
    isUnavailable,
    unavailableReason: isUnavailable ? raw?.reason : undefined,
    /** AI tashxis bergan — bir bosishda yakunlash mumkin; aks holda shifokor tashxisni o'zi yozadi */
    hasDiagnosis,
  };
}
