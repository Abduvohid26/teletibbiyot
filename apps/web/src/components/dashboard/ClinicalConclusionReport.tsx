'use client';

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
}

export function ClinicalConclusionReport({ analysis, compact }: ClinicalConclusionReportProps) {
  const cc = getClinicalConclusion(analysis);
  const triage = formatTriage(analysis.triageLevel);
  const primary = cc.consensusDiagnoses?.[0];

  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      <div className={cn('rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-indigo-50/60', compact ? 'p-2' : 'p-3')}>
        <p className="text-[9px] font-bold uppercase tracking-widest text-violet-600">Yakuniy klinik xulosa</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Konsilium konsensusi asosida — AI tibbiy hujjat</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80', triage.color)}>
            {triage.label} xavf
          </span>
          {cc.qualityScore?.overall != null && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 text-slate-600">
              Sifat: {cc.qualityScore.overall}/100
            </span>
          )}
        </div>
      </div>

      {!compact && (
        <div className="flex gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200/80">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 leading-relaxed">
            Bu AI konsensus xulosasi. Yakuniy tibbiy qaror faqat malakali shifokorga tegishli.
          </p>
        </div>
      )}

      {cc.mainConclusion && (
        <Section title="Asosiy xulosa" icon={Stethoscope} compact={compact}>
          <p className={cn('text-slate-700 leading-relaxed', compact ? 'text-[10px]' : 'text-xs')}>
            {cc.mainConclusion}
          </p>
        </Section>
      )}

      {(cc.consensusDiagnoses?.length ?? 0) > 0 && (
        <Section title="Konsensus tashxis(lar)" subtitle="MKB-10 — Xalqaro kasalliklar klassifikatsiyasi" icon={HeartPulse} compact={compact}>
          <div className="space-y-2">
            {cc.consensusDiagnoses!.map((d, i) => (
              <div key={i} className={cn('rounded-lg bg-white/80 border border-slate-100', compact ? 'p-2' : 'p-3')}>
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('font-bold text-slate-900', compact ? 'text-xs' : 'text-sm')}>
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
                    <p className={cn('text-slate-600 leading-relaxed', compact ? 'text-[10px]' : 'text-xs')}>{d.justification}</p>
                  </div>
                )}
                {(d.logicChain?.length ?? 0) > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] font-semibold uppercase text-slate-400 mb-1">Mantiqiy zanjir</p>
                    <ol className="space-y-0.5">
                      {d.logicChain!.map((step, j) => (
                        <li key={j} className={cn('text-slate-600 flex gap-1.5', compact ? 'text-[10px]' : 'text-xs')}>
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
        <Section title="Muqobil tashxis" icon={Stethoscope} compact={compact}>
          <div className="space-y-1.5">
            {cc.alternativeDiagnoses!.map((d, i) => (
              <div key={i} className={cn('rounded-lg bg-slate-50 border border-slate-100', compact ? 'p-2' : 'p-2.5')}>
                <p className={cn('font-semibold text-slate-800', compact ? 'text-[11px]' : 'text-xs')}>
                  {i + 2}. {d.name}
                  {d.icd10Code && <span className="text-slate-500 font-normal ml-1">({d.icd10Code})</span>}
                  {d.confidence != null && <span className="text-slate-400 ml-1">{d.confidence}%</span>}
                </p>
                {d.justification && (
                  <p className={cn('text-slate-600 mt-0.5', compact ? 'text-[10px]' : 'text-[11px]')}>{d.justification}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(cc.scientificArticles?.length ?? 0) > 0 && (
        <Section title="Tegishli ilmiy maqolalar" icon={BookOpen} compact={compact}>
          <ul className="space-y-1.5">
            {cc.scientificArticles!.map((a, i) => (
              <li key={i} className={cn('rounded-lg bg-white/70 border border-slate-100', compact ? 'p-2' : 'p-2.5')}>
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('font-semibold text-brand-700 hover:underline inline-flex items-center gap-1', compact ? 'text-[10px]' : 'text-xs')}
                  >
                    {a.title}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <p className={cn('font-semibold text-slate-800', compact ? 'text-[10px]' : 'text-xs')}>{a.title}</p>
                )}
                {a.description && (
                  <p className={cn('text-slate-500 mt-0.5', compact ? 'text-[9px]' : 'text-[10px]')}>{a.description}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(cc.treatmentSteps?.length ?? 0) > 0 && (
        <Section title="Tavsiya etilgan davolash rejasi" icon={CheckCircle2} compact={compact}>
          <ol className="space-y-1">
            {cc.treatmentSteps!.map((step, i) => (
              <li key={i} className={cn('flex gap-2 text-slate-700', compact ? 'text-[10px]' : 'text-xs')}>
                <span className="font-bold text-emerald-600 shrink-0">{i + 1}.</span>
                <span>{step.replace(/^\d+\.\s*/, '')}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {((cc.medicationWarnings?.length ?? 0) > 0 || (cc.medications?.length ?? 0) > 0) && (
        <Section title="Dori-darmonlar bo'yicha tavsiyalar (O'zbekiston)" icon={Pill} compact={compact}>
          {(cc.medicationWarnings?.length ?? 0) > 0 && (
            <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200/80">
              <p className="text-[9px] font-bold uppercase text-amber-700 mb-1">Farmakolog ogohlantirishlari</p>
              <ul className="space-y-0.5">
                {cc.medicationWarnings!.map((w, i) => (
                  <li key={i} className={cn('text-amber-800', compact ? 'text-[10px]' : 'text-xs')}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
          {(cc.medications?.length ?? 0) > 0 && (
            <div className="space-y-2">
              {cc.medications!.map((m, i) => (
                <div key={i} className={cn('rounded-lg bg-white/80 border border-slate-100', compact ? 'p-2' : 'p-2.5')}>
                  <p className={cn('font-bold text-slate-900', compact ? 'text-xs' : 'text-sm')}>{m.name}</p>
                  {m.dose && <p className="text-[10px] text-slate-600">Doza: {m.dose}</p>}
                  {m.tradeNames && <p className="text-[10px] text-slate-500">Mahalliy nomlar: {m.tradeNames}</p>}
                  {m.instructions && <p className={cn('text-slate-600 mt-1', compact ? 'text-[10px]' : 'text-xs')}>{m.instructions}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {((cc.additionalTests?.length ?? 0) > 0 || cc.followUp || cc.patientRouting) && (
        <Section title="Keyingi qadamlar rejasi" icon={Route} compact={compact}>
          {(cc.additionalTests?.length ?? 0) > 0 && (
            <div className="mb-2">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Qo'shimcha tekshiruvlar</p>
              <ul className="space-y-0.5">
                {cc.additionalTests!.map((t, i) => (
                  <li key={i} className={cn('text-slate-700', compact ? 'text-[10px]' : 'text-xs')}>• {t}</li>
                ))}
              </ul>
            </div>
          )}
          {cc.patientRouting && (
            <p className={cn('text-slate-700 mb-1', compact ? 'text-[10px]' : 'text-xs')}>
              <span className="font-semibold">Yo&apos;nalish:</span> {cc.patientRouting.level}
              {cc.patientRouting.description ? ` — ${cc.patientRouting.description}` : ''}
            </p>
          )}
          {(cc.recommendedSpecialists?.length ?? 0) > 0 && (
            <div className="mb-1">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Tavsiya etilgan mutaxassislar</p>
              {cc.recommendedSpecialists!.map((s, i) => (
                <p key={i} className={cn('text-slate-700', compact ? 'text-[10px]' : 'text-xs')}>• {s}</p>
              ))}
            </div>
          )}
          {cc.followUp && (
            <p className={cn('text-brand-700 font-medium', compact ? 'text-[10px]' : 'text-xs')}>
              Keyingi kuzatuv: {cc.followUp}
            </p>
          )}
        </Section>
      )}

      {((cc.riskFactors?.length ?? 0) > 0 || cc.riskSeverity) && (
        <Section title="Xavf omillari" icon={Shield} compact={compact}>
          {cc.riskSeverity && (
            <p className={cn('font-semibold text-slate-800 mb-1', compact ? 'text-[10px]' : 'text-xs')}>
              Holat og&apos;irligi: {cc.riskSeverity.label ?? 'Baholangan'}
              {cc.riskSeverity.score != null && ` (${cc.riskSeverity.score}/${cc.riskSeverity.max ?? 10})`}
            </p>
          )}
          <ul className="space-y-0.5">
            {cc.riskFactors!.map((r, i) => (
              <li key={i} className={cn('text-slate-700', compact ? 'text-[10px]' : 'text-xs')}>• {r}</li>
            ))}
          </ul>
        </Section>
      )}

      {(cc.prognosisShort || cc.prognosisLong) && (
        <Section title="Kasallik prognozi" icon={HeartPulse} compact={compact}>
          {cc.prognosisShort && (
            <div className="mb-2">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Qisqa muddatli (1–3 oy)</p>
              <p className={cn('text-slate-700', compact ? 'text-[10px]' : 'text-xs')}>{cc.prognosisShort}</p>
            </div>
          )}
          {cc.prognosisLong && (
            <div className="mb-2">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Uzoq muddatli (1–5 yil)</p>
              <p className={cn('text-slate-700', compact ? 'text-[10px]' : 'text-xs')}>{cc.prognosisLong}</p>
            </div>
          )}
          {(cc.prognosisFactors?.length ?? 0) > 0 && (
            <ul className="space-y-0.5 mt-1">
              {cc.prognosisFactors!.map((f, i) => (
                <li key={i} className={cn('text-slate-600', compact ? 'text-[10px]' : 'text-xs')}>• {f}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {((cc.dietGeneral?.length ?? 0) > 0 || cc.dietByDiagnosis) && (
        <Section title="To'g'ri ovqatlanish va parhez" icon={Utensils} compact={compact}>
          {(cc.dietGeneral?.length ?? 0) > 0 && (
            <ul className="space-y-0.5 mb-2">
              {cc.dietGeneral!.map((d, i) => (
                <li key={i} className={cn('text-slate-700', compact ? 'text-[10px]' : 'text-xs')}>• {d}</li>
              ))}
            </ul>
          )}
          {cc.dietByDiagnosis && (
            <div className={cn('rounded-lg bg-emerald-50/80 border border-emerald-100', compact ? 'p-2' : 'p-2.5')}>
              {cc.dietByDiagnosis.diagnosis && (
                <p className={cn('font-semibold text-emerald-900 mb-1', compact ? 'text-[10px]' : 'text-xs')}>
                  {cc.dietByDiagnosis.diagnosis}
                </p>
              )}
              {(cc.dietByDiagnosis.allowed?.length ?? 0) > 0 && (
                <p className={cn('text-slate-700', compact ? 'text-[10px]' : 'text-xs')}>
                  <span className="font-medium text-emerald-700">Ruxsat:</span> {cc.dietByDiagnosis.allowed!.join('; ')}
                </p>
              )}
              {(cc.dietByDiagnosis.restricted?.length ?? 0) > 0 && (
                <p className={cn('text-slate-700 mt-0.5', compact ? 'text-[10px]' : 'text-xs')}>
                  <span className="font-medium text-red-600">Cheklangan:</span> {cc.dietByDiagnosis.restricted!.join('; ')}
                </p>
              )}
              {cc.dietByDiagnosis.notes && (
                <p className={cn('text-slate-600 mt-1 italic', compact ? 'text-[10px]' : 'text-xs')}>{cc.dietByDiagnosis.notes}</p>
              )}
            </div>
          )}
          {(cc.preventionTips?.length ?? 0) > 0 && (
            <ul className="space-y-0.5 mt-2">
              {cc.preventionTips!.map((p, i) => (
                <li key={i} className={cn('text-slate-600', compact ? 'text-[10px]' : 'text-xs')}>• {p}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {(cc.herbalMedicine?.length ?? 0) > 0 && (
        <Section title="Xalq tabobati va dorivor o'simliklar" icon={Leaf} compact={compact}>
          <p className={cn('text-slate-500 mb-2 italic', compact ? 'text-[9px]' : 'text-[10px]')}>
            Rasmiy dori va shifokor ko&apos;rsatmasining o&apos;rnini bosmaydi.
          </p>
          <div className="space-y-1.5">
            {cc.herbalMedicine!.map((h, i) => (
              <div key={i} className={cn('rounded-lg bg-green-50/60 border border-green-100', compact ? 'p-2' : 'p-2.5')}>
                <p className={cn('font-semibold text-slate-800', compact ? 'text-[10px]' : 'text-xs')}>{h.name}</p>
                {h.part && <p className="text-[10px] text-slate-500">Qismi: {h.part}</p>}
                {h.preparation && <p className="text-[10px] text-slate-600">Tayyorlash: {h.preparation}</p>}
                {h.context && <p className={cn('text-slate-600', compact ? 'text-[10px]' : 'text-xs')}>{h.context}</p>}
                {h.caution && <p className="text-[10px] text-amber-700 mt-0.5">Ehtiyotkorlik: {h.caution}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {cc.qualityScore?.overall != null && (
        <Section title="Tibbiy yordam sifati (protokol asosida)" icon={FlaskConical} compact={compact}>
          <div className="flex items-center gap-3">
            <div className={cn('font-bold text-brand-600', compact ? 'text-xl' : 'text-2xl')}>
              {cc.qualityScore.overall}/100
            </div>
            {cc.qualityScore.notes && (
              <p className={cn('text-slate-600 flex-1', compact ? 'text-[10px]' : 'text-xs')}>{cc.qualityScore.notes}</p>
            )}
          </div>
        </Section>
      )}

      {(cc.recordedFindings?.length ?? 0) > 0 && (
        <Section title="Kartada qayd etilgan ma'lumotlar" icon={CheckCircle2} compact={compact}>
          <ul className="space-y-0.5">
            {cc.recordedFindings!.map((f, i) => (
              <li key={i} className={cn('text-slate-700', compact ? 'text-[10px]' : 'text-xs')}>• {f}</li>
            ))}
          </ul>
        </Section>
      )}

      {(cc.rejectedHypotheses?.length ?? 0) > 0 && (
        <Section title="Inkori etilgan gipotezalar" icon={AlertTriangle} compact={compact}>
          <div className="space-y-1.5">
            {cc.rejectedHypotheses!.map((h, i) => (
              <div key={i} className={cn('rounded-lg bg-slate-50 border border-slate-100', compact ? 'p-2' : 'p-2.5')}>
                <p className={cn('font-semibold text-slate-800', compact ? 'text-[10px]' : 'text-xs')}>{h.name}</p>
                {h.reason && <p className={cn('text-slate-600 mt-0.5', compact ? 'text-[10px]' : 'text-xs')}>{h.reason}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {analysis.redFlags.length > 0 && (
        <div className={cn('rounded-xl bg-red-50 border border-red-200', compact ? 'p-2' : 'p-3')}>
          <p className={cn('font-bold text-red-700 mb-1', compact ? 'text-[10px]' : 'text-xs')}>Qizil bayroqlar</p>
          {analysis.redFlags.map((flag, i) => (
            <p key={i} className={cn('text-red-600', compact ? 'text-[10px]' : 'text-[11px]')}>{flag}</p>
          ))}
        </div>
      )}

      {primary && compact && (
        <p className="text-[9px] text-slate-400 text-center pt-1">
          Asosiy: {primary.name} ({primary.icd10Code}) — {primary.confidence}%
        </p>
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
