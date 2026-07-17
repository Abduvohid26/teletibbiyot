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
} from 'lucide-react';
import { AiAnalysis } from '@/lib/api';
import { getClinicalConclusion } from '@/lib/clinical-conclusion';
import { formatTriage, cn } from '@/lib/utils';

interface ClinicalConclusionReportProps {
  analysis: AiAnalysis;
  compact?: boolean;
  expanded?: boolean;
}

export function ClinicalConclusionReport({ analysis, compact, expanded }: ClinicalConclusionReportProps) {
  const cc = useMemo(() => getClinicalConclusion(analysis), [analysis]);
  const triage = formatTriage(analysis.triageLevel);
  const primary = cc.consensusDiagnoses?.[0];
  const dense = compact && !expanded;
  const diet = cc.dietByDiagnosis;
  const hasDietByDiagnosis = !!diet && (
    !!diet.diagnosis
    || (diet.allowed?.length ?? 0) > 0
    || (diet.restricted?.length ?? 0) > 0
    || !!diet.notes
  );

  return (
    <div className={cn('space-y-3', dense && 'space-y-2')}>
      <div className={cn('rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-indigo-50/60', dense ? 'p-2' : 'p-3')}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">YAKUNIY KLINIK XULOSA</p>
        <p className="text-xs text-slate-500 mt-0.5">Konsilium konsensusi asosida — tibbiy hujjat</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full bg-white/80', triage.color)}>
            {triage.label} xavf
          </span>
          {cc.qualityScore?.overall != null && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/80 text-slate-600">
              Sifat: {cc.qualityScore.overall}/100
            </span>
          )}
        </div>
      </div>

      {cc.mainConclusion && (
        <Section title="Asosiy xulosa" subtitle="Konsensus tashxis va kritik topilmalar" icon={Stethoscope} compact={dense}>
          <p className={cn('text-slate-700 leading-relaxed', dense ? 'text-xs' : 'text-sm')}>
            {cc.mainConclusion}
          </p>
        </Section>
      )}

      {(cc.consensusDiagnoses?.length ?? 0) > 0 && (
        <Section title="Konsensus tashxis(lar)" subtitle="MKB-10 — Xalqaro kasalliklar klassifikatsiyasi (10-reviziya)" icon={HeartPulse} compact={dense}>
          <div className="space-y-2">
            {cc.consensusDiagnoses!.map((d, i) => (
              <div key={i} className={cn('rounded-lg bg-white/80 border border-slate-100', dense ? 'p-2' : 'p-3')}>
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('font-bold text-slate-900', dense ? 'text-xs' : 'text-sm')}>
                    {i + 1}. {d.name}
                  </p>
                  <span className="text-[10px] font-bold text-brand-600 shrink-0">{d.confidence}%</span>
                </div>
                {d.icd10Code && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    MKB-10: <span className="font-mono font-semibold text-slate-700">{d.icd10Code}</span>
                  </p>
                )}
                {d.protocolReference && (
                  <p className="text-[10px] text-teal-700 mt-1">{d.protocolReference}</p>
                )}
                {d.justification && (
                  <div className="mt-2">
                    <p className="text-[9px] font-semibold uppercase text-slate-400 mb-0.5">Asoslash</p>
                    <p className={cn('text-slate-600 leading-relaxed', dense ? 'text-[10px]' : 'text-xs')}>{d.justification}</p>
                  </div>
                )}
                {(d.logicChain?.length ?? 0) > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] font-semibold uppercase text-slate-400 mb-1">Mantiqiy zanjir</p>
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
        <Section title="Muqobil tashxis" icon={Stethoscope} compact={dense}>
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
        <Section title="Tegishli ilmiy maqolalar" icon={BookOpen} compact={dense}>
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
                {a.description && (
                  <p className={cn('text-slate-500 mt-0.5', dense ? 'text-[9px]' : 'text-[10px]')}>{a.description}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(cc.treatmentSteps?.length ?? 0) > 0 && (
        <Section title="Tavsiya etilgan davolash rejasi" icon={CheckCircle2} compact={dense}>
          <ol className="space-y-1">
            {cc.treatmentSteps!.map((step, i) => (
              <li key={i} className={cn('flex gap-2 text-slate-700', dense ? 'text-xs' : 'text-sm')}>
                <span className="font-bold text-emerald-600 shrink-0">qadam:</span>
                <span>{step.replace(/^(qadam:\s*)?/i, '').replace(/^\d+\.\s*/, '')}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {((cc.medicationWarnings?.length ?? 0) > 0 || (cc.medications?.length ?? 0) > 0) && (
        <Section title="Dori-darmonlar bo'yicha tavsiyalar (O'zbekiston)" icon={Pill} compact={dense}>
          {(cc.medicationWarnings?.length ?? 0) > 0 && (
            <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200/80">
              <p className="text-[9px] font-bold uppercase text-amber-700 mb-1">Farmakolog ogohlantirishlari</p>
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
                  {m.dose && <p className="text-[10px] text-slate-600">Doza: {m.dose}</p>}
                  {m.tradeNames && <p className="text-[10px] text-slate-500">Mahalliy nomlar: {m.tradeNames}</p>}
                  {m.instructions && <p className={cn('text-slate-600 mt-1', dense ? 'text-[10px]' : 'text-xs')}>{m.instructions}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {((cc.additionalTests?.length ?? 0) > 0 || cc.followUp || cc.patientRouting?.level) && (
        <Section title="Keyingi qadamlar rejasi" icon={Route} compact={dense}>
          {(cc.additionalTests?.length ?? 0) > 0 && (
            <div className="mb-2">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Qo'shimcha tekshiruvlar</p>
              <ul className="space-y-0.5">
                {cc.additionalTests!.map((t, i) => (
                  <li key={i} className={cn('text-slate-700', dense ? 'text-[10px]' : 'text-xs')}>• {t}</li>
                ))}
              </ul>
            </div>
          )}
          {cc.patientRouting?.level && (
            <p className={cn('text-slate-700 mb-1', dense ? 'text-[10px]' : 'text-xs')}>
              <span className="font-semibold">Yo&apos;nalish:</span> {cc.patientRouting.level}
              {cc.patientRouting.description ? ` — ${cc.patientRouting.description}` : ''}
            </p>
          )}
          {(cc.recommendedSpecialists?.length ?? 0) > 0 && (
            <div className="mb-1">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Tavsiya etilgan mutaxassislar</p>
              {cc.recommendedSpecialists!.map((s, i) => (
                <p key={i} className={cn('text-slate-700', dense ? 'text-[10px]' : 'text-xs')}>• {s}</p>
              ))}
            </div>
          )}
          {cc.followUp && (
            <p className={cn('text-brand-700 font-medium', dense ? 'text-[10px]' : 'text-xs')}>
              Keyingi kuzatuv: {cc.followUp}
            </p>
          )}
        </Section>
      )}

      {((cc.riskFactors?.length ?? 0) > 0 || cc.riskSeverity) && (
        <Section title="Xavf omillari" icon={Shield} compact={dense}>
          {cc.riskSeverity && (
            <p className={cn('font-semibold text-slate-800 mb-1', dense ? 'text-[10px]' : 'text-xs')}>
              Holat og&apos;irligi: {cc.riskSeverity.label ?? 'Baholangan'}
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
        <Section title="Kasallik prognozi" icon={HeartPulse} compact={dense}>
          {cc.prognosisShort && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Qisqa muddatli (1–3 oy)</p>
              <p className={cn('text-slate-700', dense ? 'text-xs' : 'text-sm')}>{cc.prognosisShort}</p>
            </div>
          )}
          {cc.prognosisLong && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Uzoq muddatli (1–5 yil)</p>
              <p className={cn('text-slate-700', dense ? 'text-xs' : 'text-sm')}>{cc.prognosisLong}</p>
            </div>
          )}
          {(cc.prognosisFactors?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Prognozga ta&apos;sir etuvchi omillar</p>
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
        <Section title="To'g'ri ovqatlanish va kasalliklarni oldini olish (profilaktika)" icon={Utensils} compact={dense}>
          <p className={cn('text-slate-600 mb-2', dense ? 'text-xs' : 'text-sm')}>
            Tashxisga mos parhez va profilaktika choralari.
          </p>
          {(cc.dietGeneral?.length ?? 0) > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">To&apos;g&apos;ri ovqatlanish bo&apos;yicha</p>
              <ul className="space-y-0.5">
                {cc.dietGeneral!.map((d, i) => (
                  <li key={i} className={cn('text-slate-700', dense ? 'text-xs' : 'text-sm')}>• {d}</li>
                ))}
              </ul>
            </div>
          )}
          {(cc.preventionTips?.length ?? 0) > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Profilaktika va oldini olish</p>
              <ul className="space-y-0.5">
                {cc.preventionTips!.map((p, i) => (
                  <li key={i} className={cn('text-slate-600', dense ? 'text-xs' : 'text-sm')}>• {p}</li>
                ))}
              </ul>
            </div>
          )}
          {hasDietByDiagnosis && diet && (
            <div className={cn('rounded-lg bg-emerald-50/80 border border-emerald-100', dense ? 'p-2' : 'p-2.5')}>
              <p className="text-[10px] font-bold uppercase text-emerald-800 mb-1">Tashxis bo&apos;yicha individual parhez</p>
              {diet.diagnosis && (
                <p className={cn('font-semibold text-emerald-900 mb-1', dense ? 'text-xs' : 'text-sm')}>
                  {diet.diagnosis}
                </p>
              )}
              {(diet.allowed?.length ?? 0) > 0 && (
                <p className={cn('text-slate-700', dense ? 'text-xs' : 'text-sm')}>
                  <span className="font-medium text-emerald-700">Ruxsat etilgan:</span> {diet.allowed!.join('; ')}
                </p>
              )}
              {(diet.restricted?.length ?? 0) > 0 && (
                <p className={cn('text-slate-700 mt-0.5', dense ? 'text-xs' : 'text-sm')}>
                  <span className="font-medium text-red-600">Cheklangan:</span> {diet.restricted!.join('; ')}
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
        <Section title="Xalq tabobati va dorivor o'simliklar (qo'shimcha)" icon={Leaf} compact={dense}>
          <p className={cn('text-slate-500 mb-2 italic', dense ? 'text-xs' : 'text-sm')}>
            Bu bo&apos;lim rasmiy dori-darmonlar va shifokor ko&apos;rsatmasining o&apos;rnini bosmaydi; faqat qo&apos;shimcha ma&apos;lumot sifatida beriladi.
          </p>
          <div className="space-y-1.5">
            {cc.herbalMedicine!.map((h, i) => (
              <div key={i} className={cn('rounded-lg bg-green-50/60 border border-green-100', dense ? 'p-2' : 'p-2.5')}>
                <p className={cn('font-semibold text-slate-800', dense ? 'text-xs' : 'text-sm')}>{h.name}</p>
                {h.part && <p className="text-[10px] text-slate-500">Qismi: {h.part}</p>}
                {h.preparation && <p className="text-[10px] text-slate-600">Tayyorlash: {h.preparation}</p>}
                {h.context && <p className={cn('text-slate-600', dense ? 'text-[10px]' : 'text-xs')}>{h.context}</p>}
                {h.caution && <p className="text-[10px] text-amber-700 mt-0.5">Ehtiyotkorlik: {h.caution}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {cc.qualityScore?.overall != null && (
        <Section title="Tibbiy yordam sifati (protokol asosida)" icon={FlaskConical} compact={dense}>
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

      {(cc.recordedFindings?.length ?? 0) > 0 && (
        <Section title="Kartada qayd etilgan ma'lumotlar" icon={CheckCircle2} compact={dense}>
          <ul className="space-y-0.5">
            {cc.recordedFindings!.map((f, i) => (
              <li key={i} className={cn('text-slate-700', dense ? 'text-xs' : 'text-sm')}>• {f}</li>
            ))}
          </ul>
        </Section>
      )}

      {(cc.rejectedHypotheses?.length ?? 0) > 0 && (
        <Section title="Rad etilgan gipotezalar" icon={AlertTriangle} compact={dense}>
          <div className="space-y-1.5">
            {cc.rejectedHypotheses!.map((h, i) => (
              <div key={i} className={cn('rounded-lg bg-slate-50 border border-slate-100', dense ? 'p-2' : 'p-2.5')}>
                <p className={cn('font-semibold text-slate-800', dense ? 'text-xs' : 'text-sm')}>{h.name}</p>
                {h.reason && <p className={cn('text-slate-600 mt-0.5', dense ? 'text-xs' : 'text-sm')}>Sabab: {h.reason}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {analysis.redFlags.length > 0 && (
        <div className={cn('rounded-xl bg-red-50 border border-red-200', dense ? 'p-2' : 'p-3')}>
          <p className={cn('font-bold text-red-700 mb-1', dense ? 'text-xs' : 'text-sm')}>Qizil bayroqlar</p>
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
