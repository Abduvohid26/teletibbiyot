'use client';

import { useMemo } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  HeartPulse,
  Leaf,
  Pill,
  Route,
  Shield,
  Stethoscope,
  Utensils,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { AiAnalysis } from '@/lib/api';
import {
  getClinicalConclusion,
  localizeAnalysis,
  type EvidenceLevel,
  type SourceType,
} from '@/lib/clinical-conclusion';
import { formatTriage, cn } from '@/lib/utils';
import { useI18n, LOCALE_LABELS, isLocale, type Locale } from '@/i18n';

/** Tashxis qanchalik obyektiv dalilga tayanishini ko'rsatuvchi belgi */
const EVIDENCE_STYLES: Record<EvidenceLevel, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700',
  probable: 'bg-amber-50 text-amber-700',
  possible: 'bg-slate-100 text-slate-600',
};

const EVIDENCE_LABEL_KEYS: Record<EvidenceLevel, string> = {
  confirmed: 'clinical.evidenceConfirmed',
  probable: 'clinical.evidenceProbable',
  possible: 'clinical.evidencePossible',
};

const SOURCE_STYLES: Record<SourceType, string> = {
  protocol: 'bg-teal-50 text-teal-700',
  guideline: 'bg-indigo-50 text-indigo-700',
  article: 'bg-violet-50 text-violet-700',
  general: 'bg-slate-100 text-slate-600',
};

const SOURCE_LABEL_KEYS: Record<SourceType, string> = {
  protocol: 'clinical.sourceProtocol',
  guideline: 'clinical.sourceGuideline',
  article: 'clinical.sourceArticle',
  general: 'clinical.sourceGeneral',
};

interface ClinicalConclusionReportProps {
  analysis: AiAnalysis;
  compact?: boolean;
  expanded?: boolean;
  /** Interfeys tilida tarjima yo'q bo'lsa — uni qayta so'rash */
  onRequestTranslation?: () => void;
  translating?: boolean;
  /** Avtomatik tarjima urinishi muvaffaqiyatsiz tugadi */
  translationFailed?: boolean;
}

function readContentLocale(analysis: AiAnalysis): Locale | null {
  const top = (analysis as { contentLocale?: unknown }).contentLocale;
  if (isLocale(top)) return top;
  const raw = analysis.rawResponse;
  if (raw && typeof raw === 'object' && 'contentLocale' in raw && isLocale(raw.contentLocale)) {
    return raw.contentLocale;
  }
  return null;
}

function triageLevelKey(level?: string): string {
  switch (level) {
    case 'MEDIUM':
      return 'clinical.triageMedium';
    case 'HIGH':
      return 'clinical.triageHigh';
    case 'EMERGENCY':
      return 'clinical.triageEmergency';
    case 'LOW':
    default:
      return 'clinical.triageLow';
  }
}

export function ClinicalConclusionReport({
  analysis: rawAnalysis,
  compact,
  expanded,
  onRequestTranslation,
  translating,
  translationFailed,
}: ClinicalConclusionReportProps) {
  const { t, locale } = useI18n();
  // Interfeys tili almashganda mos tarjima snapshotiga o'tamiz
  const localized = useMemo(() => localizeAnalysis(rawAnalysis, locale), [rawAnalysis, locale]);
  const analysis = localized.analysis;
  const cc = useMemo(() => getClinicalConclusion(analysis), [analysis]);
  const triage = formatTriage(analysis.triageLevel);
  const triageLabel = t(triageLevelKey(analysis.triageLevel));
  const dense = compact && !expanded;
  const diet = cc.dietByDiagnosis;
  const hasDietByDiagnosis = !!diet && (
    !!diet.diagnosis
    || (diet.allowed?.length ?? 0) > 0
    || (diet.restricted?.length ?? 0) > 0
    || !!diet.notes
  );
  // Badge tahlil ASLIDA qaysi tilda yaratilganini ko'rsatadi
  const contentLocale = readContentLocale(rawAnalysis);

  return (
    <div className={cn('space-y-3 transition-opacity', dense && 'space-y-2', translating && 'opacity-70')}>
      <div className={cn('rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-indigo-50/60', dense ? 'p-2' : 'p-3')}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">{t('clinical.finalTitle')}</p>
        <p className="text-xs text-slate-500 mt-0.5">{t('clinical.finalSubtitle')}</p>
        {contentLocale && (
          <p className="text-[10px] text-slate-400 mt-1">
            {t('clinical.generatedIn', { lang: LOCALE_LABELS[contentLocale] })}
          </p>
        )}
        {translating ? (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-violet-50/90 border border-violet-200/70 px-2 py-1.5">
            <Loader2 size={13} className="text-violet-600 animate-spin shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-violet-800">{t('clinical.translatingTitle')}</p>
              <p className="text-[10px] text-violet-700/80">{t('clinical.translatingHint')}</p>
            </div>
          </div>
        ) : !localized.available ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50/90 border border-amber-200/70 px-2 py-1.5">
            <span className="text-[10px] text-amber-800">
              {translationFailed ? t('clinical.translateFailed') : t('clinical.notTranslated')}
            </span>
            {onRequestTranslation && (
              <button
                type="button"
                onClick={onRequestTranslation}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-600 text-white hover:bg-violet-700"
              >
                {t('clinical.translateNow')}
              </button>
            )}
          </div>
        ) : null}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full bg-white/80', triage.color)}>
            {t('clinical.triageRisk', { level: triageLabel })}
          </span>
          {cc.qualityScore?.overall != null && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/80 text-slate-600">
              {t('clinical.qualityBadge', { score: cc.qualityScore.overall })}
            </span>
          )}
        </div>
      </div>

      {cc.mainConclusion && (
        <Section title={t('clinical.mainConclusion')} subtitle={t('clinical.mainConclusionSub')} icon={Stethoscope} compact={dense}>
          <p className={cn('text-slate-700 leading-relaxed', dense ? 'text-xs' : 'text-sm')}>
            {cc.mainConclusion}
          </p>
        </Section>
      )}

      {(cc.consensusDiagnoses?.length ?? 0) > 0 && (
        <Section title={t('clinical.consensusDiagnoses')} subtitle={t('clinical.icd10Subtitle')} icon={HeartPulse} compact={dense}>
          <div className="space-y-2">
            {cc.consensusDiagnoses!.map((d, i) => (
              <div key={i} className={cn('rounded-lg bg-white/80 border border-slate-100', dense ? 'p-2' : 'p-3')}>
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('font-bold text-slate-900', dense ? 'text-xs' : 'text-sm')}>
                    {i + 1}. {d.name}
                  </p>
                  <span className="text-[10px] font-bold text-brand-600 shrink-0">{d.confidence}%</span>
                </div>
                {d.evidenceLevel && (
                  <span
                    className={cn(
                      'inline-block mt-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
                      EVIDENCE_STYLES[d.evidenceLevel],
                    )}
                  >
                    {t(EVIDENCE_LABEL_KEYS[d.evidenceLevel])}
                  </span>
                )}
                {d.icd10Code && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {t('clinical.icd10')}: <span className="font-mono font-semibold text-slate-700">{d.icd10Code}</span>
                  </p>
                )}
                {d.protocolReference && (
                  <p className="text-[10px] text-teal-700 mt-1">{d.protocolReference}</p>
                )}
                {d.justification && (
                  <div className="mt-2">
                    <p className="text-[9px] font-semibold uppercase text-slate-400 mb-0.5">{t('clinical.justification')}</p>
                    <p className={cn('text-slate-600 leading-relaxed', dense ? 'text-[10px]' : 'text-xs')}>{d.justification}</p>
                  </div>
                )}
                {(d.logicChain?.length ?? 0) > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] font-semibold uppercase text-slate-400 mb-1">{t('clinical.logicChain')}</p>
                    <ol className="space-y-0.5">
                      {d.logicChain!.map((step, j) => (
                        <li key={j} className={cn('text-slate-600 flex gap-1.5', dense ? 'text-[10px]' : 'text-xs')}>
                          <span className="text-brand-500 font-bold shrink-0">{j + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(cc.alternativeDiagnoses?.length ?? 0) > 0 && (
        <Section title={t('clinical.alternatives')} icon={Stethoscope} compact={dense}>
          <div className="space-y-1.5">
            {cc.alternativeDiagnoses!.map((d, i) => (
              <div key={i} className={cn('rounded-lg bg-slate-50 border border-slate-100', dense ? 'p-2' : 'p-2.5')}>
                <p className={cn('font-semibold text-slate-800', dense ? 'text-[11px]' : 'text-xs')}>
                  {i + 2}. {d.name}
                  {d.icd10Code && <span className="text-slate-500 font-normal ml-1">({d.icd10Code})</span>}
                  {d.confidence != null && <span className="text-slate-400 ml-1">{d.confidence}%</span>}
                </p>
                {d.justification && (
                  <p className={cn('text-slate-600 mt-0.5', dense ? 'text-[10px]' : 'text-[11px]')}>{d.justification}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(cc.scientificArticles?.length ?? 0) > 0 && (
        <Section title={t('clinical.scientificArticles')} icon={BookOpen} compact={dense}>
          <ul className="space-y-1.5">
            {cc.scientificArticles!.map((a, i) => (
              <li key={i} className={cn('rounded-lg bg-white/70 border border-slate-100', dense ? 'p-2' : 'p-2.5')}>
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('font-semibold text-brand-700 hover:underline inline-flex items-center gap-1', dense ? 'text-[10px]' : 'text-xs')}
                  >
                    {a.title}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <p className={cn('font-semibold text-slate-800', dense ? 'text-[10px]' : 'text-xs')}>{a.title}</p>
                )}
                {a.sourceType && (
                  <span
                    className={cn(
                      'inline-block ml-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded align-middle',
                      SOURCE_STYLES[a.sourceType],
                    )}
                  >
                    {t(SOURCE_LABEL_KEYS[a.sourceType])}
                  </span>
                )}
                {a.description && (
                  <p className={cn('text-slate-500 mt-0.5', dense ? 'text-[9px]' : 'text-[10px]')}>{a.description}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(cc.treatmentSteps?.length ?? 0) > 0 && (
        <Section title={t('clinical.treatmentPlan')} icon={CheckCircle2} compact={dense}>
          <ol className="space-y-1">
            {cc.treatmentSteps!.map((step, i) => (
              <li key={i} className={cn('flex gap-2 text-slate-700', dense ? 'text-xs' : 'text-sm')}>
                <span className="font-bold text-emerald-600 shrink-0">{t('clinical.stepLabel')}</span>
                <span>{step.replace(/^(qadam:\s*)?/i, '').replace(/^\d+\.\s*/, '')}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {((cc.medicationWarnings?.length ?? 0) > 0 || (cc.medications?.length ?? 0) > 0) && (
        <Section title={t('clinical.medicationsTitle')} icon={Pill} compact={dense}>
          {(cc.medicationWarnings?.length ?? 0) > 0 && (
            <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200/80">
              <p className="text-[9px] font-bold uppercase text-amber-700 mb-1">{t('clinical.pharmaWarnings')}</p>
              <ul className="space-y-0.5">
                {cc.medicationWarnings!.map((w, i) => (
                  <li key={i} className={cn('text-amber-800', dense ? 'text-[10px]' : 'text-xs')}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
          {(cc.medications?.length ?? 0) > 0 && (
            <div className="space-y-2">
              {cc.medications!.map((m, i) => (
                <div key={i} className={cn('rounded-lg bg-white/80 border border-slate-100', dense ? 'p-2' : 'p-2.5')}>
                  <p className={cn('font-bold text-slate-900', dense ? 'text-xs' : 'text-sm')}>{m.name}</p>
                  {m.dose && <p className="text-[10px] text-slate-600">{t('clinical.dose')}: {m.dose}</p>}
                  {m.tradeNames && <p className="text-[10px] text-slate-500">{t('clinical.tradeNames')}: {m.tradeNames}</p>}
                  {m.instructions && <p className={cn('text-slate-600 mt-1', dense ? 'text-[10px]' : 'text-xs')}>{m.instructions}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {((cc.additionalTests?.length ?? 0) > 0 || cc.followUp || cc.patientRouting?.level) && (
        <Section title={t('clinical.nextSteps')} icon={Route} compact={dense}>
          {(cc.additionalTests?.length ?? 0) > 0 && (
            <div className="mb-2">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">{t('clinical.tests')}</p>
              <ul className="space-y-0.5">
                {cc.additionalTests!.map((item, i) => (
                  <li key={i} className={cn('text-slate-700', dense ? 'text-[10px]' : 'text-xs')}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
          {cc.patientRouting?.level && (
            <p className={cn('text-slate-700 mb-1', dense ? 'text-[10px]' : 'text-xs')}>
              <span className="font-semibold">{t('clinical.routingLabel')}:</span> {cc.patientRouting.level}
              {cc.patientRouting.description ? ` — ${cc.patientRouting.description}` : ''}
            </p>
          )}
          {(cc.recommendedSpecialists?.length ?? 0) > 0 && (
            <div className="mb-1">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">{t('clinical.recommendedSpecialists')}</p>
              {cc.recommendedSpecialists!.map((s, i) => (
                <p key={i} className={cn('text-slate-700', dense ? 'text-[10px]' : 'text-xs')}>• {s}</p>
              ))}
            </div>
          )}
          {cc.followUp && (
            <p className={cn('text-brand-700 font-medium', dense ? 'text-[10px]' : 'text-xs')}>
              {t('clinical.nextFollowUp')}: {cc.followUp}
            </p>
          )}
        </Section>
      )}

      {((cc.riskFactors?.length ?? 0) > 0 || cc.riskSeverity) && (
        <Section title={t('clinical.risk')} icon={Shield} compact={dense}>
          {cc.riskSeverity && (
            <p className={cn('font-semibold text-slate-800 mb-1', dense ? 'text-[10px]' : 'text-xs')}>
              {t('clinical.severity')}: {cc.riskSeverity.label ?? t('clinical.assessed')}
              {cc.riskSeverity.score != null && ` (${cc.riskSeverity.score}/${cc.riskSeverity.max ?? 10})`}
            </p>
          )}
          <ul className="space-y-0.5">
            {cc.riskFactors!.map((r, i) => (
              <li key={i} className={cn('text-slate-700', dense ? 'text-[10px]' : 'text-xs')}>• {r}</li>
            ))}
          </ul>
        </Section>
      )}

      {(cc.prognosisShort || cc.prognosisLong) && (
        <Section title={t('clinical.diseasePrognosis')} icon={HeartPulse} compact={dense}>
          {cc.prognosisShort && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">{t('clinical.prognosisShort')}</p>
              <p className={cn('text-slate-700', dense ? 'text-xs' : 'text-sm')}>{cc.prognosisShort}</p>
            </div>
          )}
          {cc.prognosisLong && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">{t('clinical.prognosisLong')}</p>
              <p className={cn('text-slate-700', dense ? 'text-xs' : 'text-sm')}>{cc.prognosisLong}</p>
            </div>
          )}
          {(cc.prognosisFactors?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{t('clinical.prognosisFactors')}</p>
              <ul className="space-y-0.5">
                {cc.prognosisFactors!.map((f, i) => (
                  <li key={i} className={cn('text-slate-600', dense ? 'text-xs' : 'text-sm')}>• {f}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {((cc.dietGeneral?.length ?? 0) > 0 || (cc.preventionTips?.length ?? 0) > 0 || hasDietByDiagnosis) && (
        <Section title={t('clinical.dietPreventionTitle')} icon={Utensils} compact={dense}>
          <p className={cn('text-slate-600 mb-2', dense ? 'text-xs' : 'text-sm')}>
            {t('clinical.dietPreventionIntro')}
          </p>
          {(cc.dietGeneral?.length ?? 0) > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{t('clinical.dietGeneralTitle')}</p>
              <ul className="space-y-0.5">
                {cc.dietGeneral!.map((d, i) => (
                  <li key={i} className={cn('text-slate-700', dense ? 'text-xs' : 'text-sm')}>• {d}</li>
                ))}
              </ul>
            </div>
          )}
          {(cc.preventionTips?.length ?? 0) > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{t('clinical.preventionTitle')}</p>
              <ul className="space-y-0.5">
                {cc.preventionTips!.map((tip, i) => (
                  <li key={i} className={cn('text-slate-600', dense ? 'text-xs' : 'text-sm')}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}
          {hasDietByDiagnosis && diet && (
            <div className={cn('rounded-lg bg-emerald-50/80 border border-emerald-100', dense ? 'p-2' : 'p-2.5')}>
              <p className="text-[10px] font-bold uppercase text-emerald-800 mb-1">{t('clinical.dietByDiagnosis')}</p>
              {diet.diagnosis && (
                <p className={cn('font-semibold text-emerald-900 mb-1', dense ? 'text-xs' : 'text-sm')}>
                  {diet.diagnosis}
                </p>
              )}
              {(diet.allowed?.length ?? 0) > 0 && (
                <p className={cn('text-slate-700', dense ? 'text-xs' : 'text-sm')}>
                  <span className="font-medium text-emerald-700">{t('clinical.allowed')}:</span> {diet.allowed!.join('; ')}
                </p>
              )}
              {(diet.restricted?.length ?? 0) > 0 && (
                <p className={cn('text-slate-700 mt-0.5', dense ? 'text-xs' : 'text-sm')}>
                  <span className="font-medium text-red-600">{t('clinical.restricted')}:</span> {diet.restricted!.join('; ')}
                </p>
              )}
              {diet.notes && (
                <p className={cn('text-slate-600 mt-1 italic', dense ? 'text-xs' : 'text-sm')}>{diet.notes}</p>
              )}
            </div>
          )}
        </Section>
      )}

      {(cc.herbalMedicine?.length ?? 0) > 0 && (
        <Section title={t('clinical.herbalTitle')} icon={Leaf} compact={dense}>
          <p className={cn('text-slate-500 mb-2 italic', dense ? 'text-xs' : 'text-sm')}>
            {t('clinical.herbalDisclaimer')}
          </p>
          <div className="space-y-1.5">
            {cc.herbalMedicine!.map((h, i) => (
              <div key={i} className={cn('rounded-lg bg-green-50/60 border border-green-100', dense ? 'p-2' : 'p-2.5')}>
                <p className={cn('font-semibold text-slate-800', dense ? 'text-xs' : 'text-sm')}>{h.name}</p>
                {h.part && <p className="text-[10px] text-slate-500">{t('clinical.part')}: {h.part}</p>}
                {h.preparation && <p className="text-[10px] text-slate-600">{t('clinical.preparation')}: {h.preparation}</p>}
                {h.context && <p className={cn('text-slate-600', dense ? 'text-[10px]' : 'text-xs')}>{h.context}</p>}
                {h.caution && <p className="text-[10px] text-amber-700 mt-0.5">{t('clinical.caution')}: {h.caution}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {cc.qualityScore?.overall != null && (
        <Section title={t('clinical.qualityProtocol')} icon={FlaskConical} compact={dense}>
          <div className="flex items-center gap-3">
            <div className={cn('font-bold text-brand-600', dense ? 'text-xl' : 'text-2xl')}>
              {cc.qualityScore.overall}/100
            </div>
            {cc.qualityScore.notes && (
              <p className={cn('text-slate-600 flex-1', dense ? 'text-xs' : 'text-sm')}>{cc.qualityScore.notes}</p>
            )}
          </div>
        </Section>
      )}

      {(cc.dataGaps?.length ?? 0) > 0 && (
        <Section title={t('clinical.dataGaps')} subtitle={t('clinical.dataGapsSubtitle')} icon={HelpCircle} compact={dense}>
          <ul className="space-y-1">
            {cc.dataGaps!.map((gap, i) => (
              <li
                key={i}
                className={cn('flex gap-1.5 text-amber-900', dense ? 'text-[11px]' : 'text-xs')}
              >
                <span className="text-amber-500 shrink-0">•</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(cc.recordedFindings?.length ?? 0) > 0 && (
        <Section title={t('clinical.cardFindings')} icon={CheckCircle2} compact={dense}>
          <ul className="space-y-0.5">
            {cc.recordedFindings!.map((f, i) => (
              <li key={i} className={cn('text-slate-700', dense ? 'text-xs' : 'text-sm')}>• {f}</li>
            ))}
          </ul>
        </Section>
      )}

      {(cc.rejectedHypotheses?.length ?? 0) > 0 && (
        <Section title={t('clinical.rejectedHypotheses')} icon={AlertTriangle} compact={dense}>
          <div className="space-y-1.5">
            {cc.rejectedHypotheses!.map((h, i) => (
              <div key={i} className={cn('rounded-lg bg-slate-50 border border-slate-100', dense ? 'p-2' : 'p-2.5')}>
                <p className={cn('font-semibold text-slate-800', dense ? 'text-xs' : 'text-sm')}>{h.name}</p>
                {h.reason && (
                  <p className={cn('text-slate-600 mt-0.5', dense ? 'text-xs' : 'text-sm')}>
                    {t('clinical.reason')}: {h.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {analysis.redFlags.length > 0 && (
        <div className={cn('rounded-xl bg-red-50 border border-red-200', dense ? 'p-2' : 'p-3')}>
          <p className={cn('font-bold text-red-700 mb-1', dense ? 'text-xs' : 'text-sm')}>{t('clinical.redFlags')}</p>
          {analysis.redFlags.map((flag, i) => (
            <p key={i} className={cn('text-red-600', dense ? 'text-xs' : 'text-sm')}>{flag}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  compact,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border border-slate-100 bg-white/60', compact ? 'p-2' : 'p-3')}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={compact ? 12 : 14} className="text-violet-600 shrink-0" />
        <div>
          <p className={cn('font-bold text-slate-800', compact ? 'text-[10px]' : 'text-xs')}>{title}</p>
          {subtitle && <p className="text-[9px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
