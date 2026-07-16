import { AiAnalysis } from '@/lib/api';

export interface ConsensusDiagnosis {
  name: string;
  icd10Code: string;
  confidence: number;
  protocolReference?: string;
  justification?: string;
  logicChain?: string[];
}

export interface AlternativeDiagnosis {
  name: string;
  icd10Code?: string;
  confidence?: number;
  justification?: string;
}

export interface ScientificArticle {
  title: string;
  url?: string;
  description?: string;
}

export interface MedicationRecommendation {
  name: string;
  dose?: string;
  tradeNames?: string;
  instructions?: string;
  diagnosis?: string;
}

export interface HerbalMedicineEntry {
  name: string;
  part?: string;
  preparation?: string;
  context?: string;
  caution?: string;
}

export interface RejectedHypothesis {
  name: string;
  reason?: string;
}

export interface ClinicalConclusion {
  mainConclusion?: string;
  consensusDiagnoses?: ConsensusDiagnosis[];
  alternativeDiagnoses?: AlternativeDiagnosis[];
  scientificArticles?: ScientificArticle[];
  treatmentSteps?: string[];
  medicationWarnings?: string[];
  medications?: MedicationRecommendation[];
  additionalTests?: string[];
  patientRouting?: { level?: string; description?: string };
  recommendedSpecialists?: string[];
  followUp?: string;
  riskFactors?: string[];
  riskSeverity?: { label?: string; score?: number; max?: number };
  prognosisShort?: string;
  prognosisLong?: string;
  prognosisFactors?: string[];
  dietGeneral?: string[];
  dietByDiagnosis?: {
    diagnosis?: string;
    allowed?: string[];
    restricted?: string[];
    notes?: string;
  };
  preventionTips?: string[];
  herbalMedicine?: HerbalMedicineEntry[];
  qualityScore?: { overall?: number; notes?: string };
  rejectedHypotheses?: RejectedHypothesis[];
  recordedFindings?: string[];
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

function parseConsensusDiagnoses(v: unknown): ConsensusDiagnosis[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = asRecord(item);
      if (!o || typeof o.name !== 'string') return null;
      return {
        name: o.name,
        icd10Code: String(o.icd10Code ?? ''),
        confidence: Number(o.confidence ?? 0),
        protocolReference: typeof o.protocolReference === 'string' ? o.protocolReference : undefined,
        justification: typeof o.justification === 'string' ? o.justification : undefined,
        logicChain: asStringArray(o.logicChain),
      } satisfies ConsensusDiagnosis;
    })
    .filter(Boolean) as ConsensusDiagnosis[];
}

function parseAlternatives(v: unknown): AlternativeDiagnosis[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = asRecord(item);
      if (!o || typeof o.name !== 'string') return null;
      return {
        name: o.name,
        icd10Code: typeof o.icd10Code === 'string' ? o.icd10Code : undefined,
        confidence: o.confidence != null ? Number(o.confidence) : undefined,
        justification: typeof o.justification === 'string' ? o.justification : undefined,
      } satisfies AlternativeDiagnosis;
    })
    .filter(Boolean) as AlternativeDiagnosis[];
}

function parseArticles(v: unknown): ScientificArticle[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = asRecord(item);
      if (!o || typeof o.title !== 'string') return null;
      return {
        title: o.title,
        url: typeof o.url === 'string' ? o.url : undefined,
        description: typeof o.description === 'string' ? o.description : undefined,
      } satisfies ScientificArticle;
    })
    .filter(Boolean) as ScientificArticle[];
}

function parseMedications(v: unknown): MedicationRecommendation[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = asRecord(item);
      if (!o || typeof o.name !== 'string') return null;
      return {
        name: o.name,
        dose: typeof o.dose === 'string' ? o.dose : undefined,
        tradeNames: typeof o.tradeNames === 'string' ? o.tradeNames : undefined,
        instructions: typeof o.instructions === 'string' ? o.instructions : undefined,
        diagnosis: typeof o.diagnosis === 'string' ? o.diagnosis : undefined,
      } satisfies MedicationRecommendation;
    })
    .filter(Boolean) as MedicationRecommendation[];
}

function parseHerbal(v: unknown): HerbalMedicineEntry[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = asRecord(item);
      if (!o || typeof o.name !== 'string') return null;
      return {
        name: o.name,
        part: typeof o.part === 'string' ? o.part : undefined,
        preparation: typeof o.preparation === 'string' ? o.preparation : undefined,
        context: typeof o.context === 'string' ? o.context : undefined,
        caution: typeof o.caution === 'string' ? o.caution : undefined,
      } satisfies HerbalMedicineEntry;
    })
    .filter(Boolean) as HerbalMedicineEntry[];
}

function parseRejected(v: unknown): RejectedHypothesis[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = asRecord(item);
      if (!o || typeof o.name !== 'string') return null;
      return {
        name: o.name,
        reason: typeof o.reason === 'string' ? o.reason : undefined,
      } satisfies RejectedHypothesis;
    })
    .filter(Boolean) as RejectedHypothesis[];
}

function parseClinicalConclusionRaw(raw: unknown): ClinicalConclusion | null {
  const o = asRecord(raw);
  if (!o) return null;

  const routing = asRecord(o.patientRouting);
  const risk = asRecord(o.riskSeverity);
  const diet = asRecord(o.dietByDiagnosis);
  const quality = asRecord(o.qualityScore);

  const result: ClinicalConclusion = {
    mainConclusion: typeof o.mainConclusion === 'string' ? o.mainConclusion : undefined,
    consensusDiagnoses: parseConsensusDiagnoses(o.consensusDiagnoses),
    alternativeDiagnoses: parseAlternatives(o.alternativeDiagnoses),
    scientificArticles: parseArticles(o.scientificArticles),
    treatmentSteps: asStringArray(o.treatmentSteps),
    medicationWarnings: asStringArray(o.medicationWarnings),
    medications: parseMedications(o.medications),
    additionalTests: asStringArray(o.additionalTests),
    patientRouting: routing
      ? {
          level: typeof routing.level === 'string' ? routing.level : undefined,
          description: typeof routing.description === 'string' ? routing.description : undefined,
        }
      : undefined,
    recommendedSpecialists: asStringArray(o.recommendedSpecialists),
    followUp: typeof o.followUp === 'string' ? o.followUp : undefined,
    riskFactors: asStringArray(o.riskFactors),
    riskSeverity: risk
      ? {
          label: typeof risk.label === 'string' ? risk.label : undefined,
          score: risk.score != null ? Number(risk.score) : undefined,
          max: risk.max != null ? Number(risk.max) : undefined,
        }
      : undefined,
    prognosisShort: typeof o.prognosisShort === 'string' ? o.prognosisShort : undefined,
    prognosisLong: typeof o.prognosisLong === 'string' ? o.prognosisLong : undefined,
    prognosisFactors: asStringArray(o.prognosisFactors),
    dietGeneral: asStringArray(o.dietGeneral),
    dietByDiagnosis: diet
      ? {
          diagnosis: typeof diet.diagnosis === 'string' ? diet.diagnosis : undefined,
          allowed: asStringArray(diet.allowed),
          restricted: asStringArray(diet.restricted),
          notes: typeof diet.notes === 'string' ? diet.notes : undefined,
        }
      : undefined,
    preventionTips: asStringArray(o.preventionTips),
    herbalMedicine: parseHerbal(o.herbalMedicine),
    qualityScore: quality
      ? {
          overall: quality.overall != null ? Number(quality.overall) : undefined,
          notes: typeof quality.notes === 'string' ? quality.notes : undefined,
        }
      : undefined,
    rejectedHypotheses: parseRejected(o.rejectedHypotheses),
    recordedFindings: asStringArray(o.recordedFindings),
  };

  const hasContent =
    !!result.mainConclusion
    || (result.consensusDiagnoses?.length ?? 0) > 0
    || (result.alternativeDiagnoses?.length ?? 0) > 0
    || (result.treatmentSteps?.length ?? 0) > 0;

  return hasContent ? result : null;
}

/** Mavjud tahlildan to'liq klinik xulosa — clinicalConclusion yoki fallback */
export function getClinicalConclusion(analysis: AiAnalysis): ClinicalConclusion {
  const fromRaw = parseClinicalConclusionRaw(analysis.rawResponse?.clinicalConclusion);
  if (fromRaw) return enrichFromLegacy(fromRaw, analysis);

  return buildFallbackConclusion(analysis);
}

function enrichFromLegacy(cc: ClinicalConclusion, analysis: AiAnalysis): ClinicalConclusion {
  if (!cc.consensusDiagnoses?.length && analysis.diagnoses.length) {
    cc.consensusDiagnoses = analysis.diagnoses.slice(0, 1).map((d) => ({
      name: d.name,
      icd10Code: d.icd10Code,
      confidence: d.confidence,
      justification: d.reasoning,
      logicChain: d.reasoning ? d.reasoning.split(/(?<=[.!])\s+/).filter(Boolean) : [],
    }));
  }
  if (!cc.alternativeDiagnoses?.length && analysis.diagnoses.length > 1) {
    cc.alternativeDiagnoses = analysis.diagnoses.slice(1).map((d) => ({
      name: d.name,
      icd10Code: d.icd10Code,
      confidence: d.confidence,
      justification: d.reasoning,
    }));
  }
  if (!cc.mainConclusion) cc.mainConclusion = analysis.summary;
  if (!cc.treatmentSteps?.length) cc.treatmentSteps = analysis.recommendations;
  if (!cc.riskFactors?.length) cc.riskFactors = analysis.redFlags;
  return cc;
}

function buildFallbackConclusion(analysis: AiAnalysis): ClinicalConclusion {
  const primary = analysis.diagnoses[0];
  const alternatives = analysis.diagnoses.slice(1);

  return {
    mainConclusion: analysis.summary,
    consensusDiagnoses: primary
      ? [{
          name: primary.name,
          icd10Code: primary.icd10Code,
          confidence: primary.confidence,
          justification: primary.reasoning,
          logicChain: primary.reasoning
            ? primary.reasoning.split(/(?<=[.!])\s+/).filter(Boolean)
            : [],
        }]
      : [],
    alternativeDiagnoses: alternatives.map((d) => ({
      name: d.name,
      icd10Code: d.icd10Code,
      confidence: d.confidence,
      justification: d.reasoning,
    })),
    treatmentSteps: analysis.recommendations,
    riskFactors: analysis.redFlags,
    additionalTests: analysis.recommendations.filter((r) =>
      /tekshir|tahlil|EKG|UZI|KT|MR|lab/i.test(r),
    ),
    followUp: analysis.recommendations.find((r) => /qayta|kuzat|ko'rik/i.test(r)),
  };
}
