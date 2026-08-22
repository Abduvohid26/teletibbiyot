import { join } from 'path';
import PDFDocument from 'pdfkit';
import { BRAND } from '@ishifo/shared';
import { formatPdfDate, getPdfLabels, normalizePdfLocale, type PdfLocale } from './pdf-labels';

type DiagnosisRow = {
  name: string;
  icd10Code: string;
  confidence: number;
  reasoning: string;
};

/**
 * PDFKit ning ichki `Helvetica` shrifti WinAnsi kodlashda — kirill harflari yo'q,
 * shuning uchun ruscha hisobot buzilib chiqardi. DejaVuSans rus va o'zbek
 * kirillini, `ʻ` (U+02BB) va tipografik belgilarni qamrab oladi.
 *
 * Yo'l ham `dist/ai` (ishlab chiqarish), ham `src/ai` (ts-node) uchun to'g'ri:
 * shriftlar nest-cli assets orqali `dist/assets/fonts` ga ko'chiriladi.
 */
const FONT_DIR = join(__dirname, '..', 'assets', 'fonts');
const FONT_REGULAR = 'Body';
const FONT_BOLD = 'BodyBold';

function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont(FONT_REGULAR, join(FONT_DIR, 'DejaVuSans.ttf'));
  doc.registerFont(FONT_BOLD, join(FONT_DIR, 'DejaVuSans-Bold.ttf'));
  doc.font(FONT_REGULAR);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

function parseClinicalConclusion(raw: unknown) {
  const cc = asRecord(raw);
  if (!cc) return null;
  return cc;
}

export interface AiAnalysisPdfInput {
  patientName: string;
  patientPhone?: string | null;
  birthDate: string;
  gender?: string;
  patientAge?: number;
  facilityName: string;
  facilityCode: string;
  doctorName?: string | null;
  triageLevel: string;
  summary: string;
  diagnoses: DiagnosisRow[];
  recommendations: string[];
  redFlags: string[];
  rawResponse?: Record<string, unknown> | null;
  complaints?: string;
  anamnesisMorbi?: string;
  medications?: string | null;
  labResults?: string | null;
  weight?: number | null;
  height?: number | null;
  bmi?: number | null;
  vitalSigns?: Record<string, number>;
}

const CONTENT_WIDTH = 495;
const VIOLET = '#4f46e5';
const SLATE_900 = '#0f172a';
const SLATE_500 = '#64748b';
const SLATE_200 = '#e2e8f0';

function ensureSpace(doc: InstanceType<typeof PDFDocument>, needed = 60) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

/** pdfkit'ning ichki kursor x-holatini chap margin'ga qaytaradi — explicit x/y bilan
 * chizilgan matnlardan (jadval, badge, ikki ustunli sarlavha) keyin keyingi oddiy
 * doc.text(str) chaqiruvlari sahifa o'rtasidan boshlanib qolmasligi uchun shart. */
function resetCursorX(doc: InstanceType<typeof PDFDocument>) {
  doc.x = doc.page.margins.left;
}

/**
 * Aniq x/y bilan chizilgan matn bloki va uning PASTKI chegarasini qaytaradi.
 *
 * Muhim: pdfkit `doc.y` ni faqat oxirgi chizilgan blokka qarab yangilaydi. Bir
 * qatorda bir nechta blok bo'lsa (masalan chapda sarlavha, o'ngda sana), keyingi
 * element eng pastki blokdan boshlanishi kerak — aks holda matnlar bir-birining
 * ustiga chiqib ketadi (ru/en da sarlavha ikki qatorga sig'ib qolgani kabi).
 * Shu sababli hech qayerda "y + 40" kabi qat'iy siljish ishlatilmaydi.
 */
function drawBlock(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  x: number,
  y: number,
  options: PDFKit.Mixins.TextOptions & { width: number },
): number {
  const height = doc.heightOfString(text, options);
  doc.text(text, x, y, options);
  return y + height;
}

function sectionTitle(doc: InstanceType<typeof PDFDocument>, title: string) {
  ensureSpace(doc, 44);
  doc.moveDown(0.5);
  resetCursorX(doc);
  const left = doc.page.margins.left;
  doc.fontSize(11).fillColor(VIOLET).font(FONT_BOLD).text(title.toUpperCase(), left, doc.y, { width: CONTENT_WIDTH });
  const lineY = doc.y + 2;
  doc.moveTo(left, lineY).lineTo(left + CONTENT_WIDTH, lineY).lineWidth(0.75).strokeColor(VIOLET).stroke();
  doc.y = lineY;
  doc.moveDown(0.4);
  resetCursorX(doc);
  doc.font(FONT_REGULAR).fontSize(10).fillColor(SLATE_900);
}

/** "Label:: Value" jadval qatorlari — referens hujjatdagi kabi ikki ustunli, chiziqcha bilan. */
function labelValueTable(doc: InstanceType<typeof PDFDocument>, rows: Array<[string, string]>) {
  const left = doc.page.margins.left;
  const labelWidth = 130;
  const valueWidth = CONTENT_WIDTH - labelWidth;
  for (const [label, value] of rows) {
    if (!value) continue;
    const valueHeight = doc.font(FONT_REGULAR).fontSize(9.5).heightOfString(value, { width: valueWidth });
    // Ruscha yorliqlar uzun — ular ham ikki qatorga sig'ishi mumkin, shuning uchun
    // qator balandligi ikkala ustunning kattasidan olinadi.
    const labelHeight = doc.font(FONT_BOLD).fontSize(9.5).heightOfString(label, { width: labelWidth });
    const rowHeight = Math.max(valueHeight, labelHeight, 14) + 8;
    ensureSpace(doc, rowHeight + 4);
    const y = doc.y;
    doc.font(FONT_BOLD).fontSize(9.5).fillColor(SLATE_500).text(label, left, y, { width: labelWidth });
    doc.font(FONT_REGULAR).fontSize(9.5).fillColor(SLATE_900).text(value, left + labelWidth, y, { width: valueWidth });
    const bottomY = y + Math.max(valueHeight, labelHeight, 14) + 4;
    doc.moveTo(left, bottomY).lineTo(left + CONTENT_WIDTH, bottomY).lineWidth(0.5).strokeColor(SLATE_200).stroke();
    doc.y = bottomY + 6;
  }
  resetCursorX(doc);
}

/** O'ng tomonga tekislangan foiz-badge (tashxis ishonch darajasi uchun). */
function confidenceBadge(doc: InstanceType<typeof PDFDocument>, confidence: number, y: number) {
  const label = `${confidence}%`;
  const w = doc.font(FONT_BOLD).fontSize(9).widthOfString(label) + 14;
  const x = doc.page.margins.left + CONTENT_WIDTH - w;
  const color = confidence >= 70 ? '#16a34a' : confidence >= 40 ? '#d97706' : '#64748b';
  const cursorY = doc.y;
  doc.roundedRect(x, y - 2, w, 16, 8).fillColor(color).fill();
  doc.fillColor('#ffffff').fontSize(9).text(label, x, y + 1, { width: w, align: 'center', lineBreak: false });
  doc.y = cursorY;
  resetCursorX(doc);
  doc.fillColor(SLATE_900).fontSize(10).font(FONT_REGULAR);
}

function bodyText(doc: InstanceType<typeof PDFDocument>, text: string) {
  ensureSpace(doc, 30);
  doc.text(text || '—', { width: 495, align: 'left' });
  doc.moveDown(0.2);
}

function bulletList(doc: InstanceType<typeof PDFDocument>, items: string[]) {
  for (const item of items) {
    ensureSpace(doc, 24);
    doc.text(`• ${item}`, { width: 490, indent: 8 });
  }
  doc.moveDown(0.15);
}

function genderLabel(g: string | undefined, locale: PdfLocale) {
  const L = getPdfLabels(locale);
  if (!g) return L.dash;
  const u = g.toUpperCase();
  if (u === 'MALE' || u === 'ERKAK') return L.male;
  if (u === 'FEMALE' || u === 'AYOL') return L.female;
  return g;
}

function fmtVital(v: number | undefined, unit: string, dash: string) {
  return v != null && v > 0 ? `${v} ${unit}` : `${dash} ${unit}`;
}

function addPageFooters(doc: InstanceType<typeof PDFDocument>, locale: PdfLocale) {
  const L = getPdfLabels(locale);
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const bottom = doc.page.height - originalBottomMargin + 10;
    doc.fontSize(7).fillColor('#64748b');
    doc.text(
      `${BRAND.name} | ${BRAND.domain} | ${L.footer}`,
      doc.page.margins.left,
      bottom,
      { width: CONTENT_WIDTH, align: 'center', lineBreak: false },
    );
    doc.text(
      `${L.page} ${i - range.start + 1}/${range.count}`,
      doc.page.margins.left,
      bottom + 10,
      { width: CONTENT_WIDTH, align: 'center', lineBreak: false },
    );
    doc.page.margins.bottom = originalBottomMargin;
  }
  doc.fillColor(SLATE_900);
}

export function buildAiAnalysisPdfBuffer(data: AiAnalysisPdfInput, localeRaw?: PdfLocale | string): Promise<Buffer> {
  const locale = normalizePdfLocale(localeRaw);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    registerFonts(doc);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = getPdfLabels(locale);
    const cc = parseClinicalConclusion(data.rawResponse?.clinicalConclusion);
    const consensus = (cc?.consensusDiagnoses as unknown[]) ?? [];
    const alternatives = (cc?.alternativeDiagnoses as unknown[]) ?? [];
    const generatedAt = formatPdfDate(locale);

    // Sarlavha ru/en da ikki qatorga sig'adi — quyidagi elementlar HAR DOIM
    // haqiqiy pastki chegaradan boshlanadi, qat'iy siljishdan emas.
    const left = doc.page.margins.left;
    const headerTop = doc.y;

    doc.font(FONT_BOLD).fontSize(16).fillColor(VIOLET);
    const titleBottom = drawBlock(doc, L.title, left, headerTop, { width: 350 });

    doc.font(FONT_REGULAR).fontSize(9).fillColor(SLATE_500);
    const dateBottom = drawBlock(
      doc,
      `${L.datePrefix} ${generatedAt}`,
      left + 360,
      headerTop + 2,
      { width: 135, align: 'right' },
    );

    doc.font(FONT_REGULAR).fontSize(8.5).fillColor(SLATE_500);
    const subtitleBottom = drawBlock(doc, L.subtitle, left, titleBottom + 4, { width: CONTENT_WIDTH });

    doc.x = left;
    doc.y = Math.max(subtitleBottom, dateBottom) + 8;
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + CONTENT_WIDTH, doc.y).lineWidth(1.5).strokeColor(VIOLET).stroke();
    doc.moveDown(0.5);

    sectionTitle(doc, L.sectionPatientInfo);
    const vs = data.vitalSigns ?? {};
    const objective = [
      data.weight != null ? `${L.weight}: ${data.weight} ${L.kg}` : null,
      data.height != null ? `${L.height}: ${data.height} ${L.cm}` : null,
      data.bmi != null ? `${L.bmi}: ${data.bmi.toFixed(1)}` : null,
      vs.bloodPressureSystolic && vs.bloodPressureDiastolic
        ? `${L.bp}: ${vs.bloodPressureSystolic}/${vs.bloodPressureDiastolic} ${L.mmHg}`
        : null,
      `${L.pulse}: ${fmtVital(vs.heartRate, L.bpm, L.dash)}`,
      `${L.temperature}: ${fmtVital(vs.temperature, L.celsius, L.dash)}`,
      `${L.spo2}: ${fmtVital(vs.spo2, L.percent, L.dash)}`,
      `${L.respiratory}: ${fmtVital(vs.respiratoryRate, L.perMin, L.dash)}`,
    ].filter((x): x is string => !!x).join('\n');

    labelValueTable(doc, [
      [L.patient, data.patientName],
      [L.age, data.patientAge != null ? `${data.patientAge} ${L.years}` : ''],
      [L.gender, genderLabel(data.gender, locale)],
      [L.objective, objective],
      [L.complaints, data.complaints ?? ''],
      [L.lab, data.labResults ?? L.labDefault],
      [L.anamnesis, data.anamnesisMorbi ?? ''],
      [L.medications, data.medications ?? ''],
      [L.facility, `${data.facilityName} (${data.facilityCode})`],
      [L.doctor, data.doctorName ?? ''],
    ]);
    doc.moveDown(0.3);

    ensureSpace(doc, 30);
    doc.moveDown(0.4);
    doc.font(FONT_BOLD).fontSize(13).fillColor(SLATE_900).text(L.consensusTitle);
    doc.font(FONT_REGULAR).fontSize(10);
    if (consensus.length > 0) {
      sectionTitle(doc, L.sectionDiagnoses);
      consensus.forEach((item, i) => {
        const row = asRecord(item);
        if (!row) return;
        ensureSpace(doc, 50);
        const rowTop = doc.y;
        const hasConfBadge = typeof row.confidence === 'number';
        if (hasConfBadge) {
          confidenceBadge(doc, row.confidence as number, rowTop);
        }
        const grade = typeof row.protocolReference === 'string' ? ` · ${row.protocolReference}` : '';
        const left = doc.page.margins.left;
        doc.fontSize(11).fillColor('#0f172a').text(`${i + 1}. ${String(row.name ?? '')}${grade}`, left, rowTop, { width: hasConfBadge ? CONTENT_WIDTH - 55 : CONTENT_WIDTH });
        doc.fontSize(10);
        resetCursorX(doc);
        if (row.icd10Code) doc.text(`${L.icd10} ${String(row.icd10Code)}`);
        if (typeof row.justification === 'string') {
          doc.moveDown(0.1);
          doc.fontSize(9).fillColor('#475569').text(`${L.justification} ${row.justification}`, { width: 495 });
          doc.fillColor('#0f172a').fontSize(10);
        }
        const chain = asStrings(row.logicChain);
        if (chain.length) {
          doc.moveDown(0.15);
          doc.fontSize(9).text(L.logicChain, { underline: true });
          chain.forEach((step, j) => doc.text(`  ${j + 1}. ${step}`, { width: 485 }));
          doc.fontSize(10);
        }
        doc.moveDown(0.25);
      });
    } else if (data.diagnoses.length) {
      data.diagnoses.forEach((d, i) => {
        ensureSpace(doc, 40);
        doc.text(`${i + 1}. ${d.name} (${d.icd10Code}) — ${d.confidence}%`);
        if (d.reasoning) doc.fontSize(9).fillColor('#475569').text(d.reasoning, { width: 495 }).fontSize(10).fillColor('#0f172a');
      });
    } else {
      bodyText(doc, L.dash);
    }

    if (alternatives.length > 0) {
      sectionTitle(doc, L.sectionAlternative);
      alternatives.forEach((item, i) => {
        const row = asRecord(item);
        if (!row) return;
        ensureSpace(doc, 30);
        doc.text(`${i + 2}. ${String(row.name ?? '')}${row.icd10Code ? ` (${String(row.icd10Code)})` : ''}${row.confidence != null ? ` — ${String(row.confidence)}%` : ''}`);
        if (typeof row.justification === 'string') {
          doc.fontSize(9).fillColor('#475569').text(row.justification, { width: 495 }).fontSize(10).fillColor('#0f172a');
        }
      });
    }

    const articles = (cc?.scientificArticles as unknown[]) ?? [];
    if (articles.length) {
      sectionTitle(doc, L.sectionArticles);
      articles.forEach((item) => {
        const row = asRecord(item);
        if (!row) return;
        ensureSpace(doc, 28);
        const title = String(row.title ?? '');
        const url = typeof row.url === 'string' ? row.url : '';
        doc.text(`• ${title}${url ? `\n  ${url}` : ''}`, { width: 490 });
        if (typeof row.description === 'string') {
          doc.fontSize(9).fillColor('#64748b').text(row.description, { width: 490 }).fontSize(10).fillColor('#0f172a');
        }
      });
    }

    const treatmentSteps = asStrings(cc?.treatmentSteps).length ? asStrings(cc?.treatmentSteps) : data.recommendations;
    if (treatmentSteps.length) {
      sectionTitle(doc, L.sectionTreatment);
      treatmentSteps.forEach((step) => {
        ensureSpace(doc, 20);
        doc.text(`• ${L.step} ${step.replace(/^\d+\.\s*/, '')}`, { width: 490 });
      });
    }

    const medWarnings = asStrings(cc?.medicationWarnings);
    const medications = (cc?.medications as unknown[]) ?? [];
    if (medWarnings.length || medications.length) {
      sectionTitle(doc, L.sectionMedications);
      if (medWarnings.length) {
        doc.fontSize(9).fillColor('#b45309').text(L.pharmacologyWarnings, { underline: true });
        doc.fillColor('#0f172a');
        bulletList(doc, medWarnings);
      }
      medications.forEach((item) => {
        const row = asRecord(item);
        if (!row) return;
        ensureSpace(doc, 36);
        doc.fontSize(10).text(String(row.name ?? ''));
        if (typeof row.dose === 'string') doc.text(`${L.dose} ${row.dose}`);
        if (typeof row.tradeNames === 'string') doc.text(`${L.tradeNames} ${row.tradeNames}`);
        if (typeof row.instructions === 'string') doc.fontSize(9).text(row.instructions, { width: 490 }).fontSize(10);
        doc.moveDown(0.2);
      });
    }

    const additionalTests = asStrings(cc?.additionalTests);
    const followUp = typeof cc?.followUp === 'string' ? cc.followUp : undefined;
    const routing = asRecord(cc?.patientRouting);
    const specialists = asStrings(cc?.recommendedSpecialists);
    if (additionalTests.length || followUp || routing || specialists.length) {
      sectionTitle(doc, L.sectionNextSteps);
      if (additionalTests.length) {
        doc.text(L.additionalTests, { underline: true });
        bulletList(doc, additionalTests);
      }
      if (routing) {
        doc.text(`${L.routing} ${routing.level ?? ''}${routing.description ? ` — ${routing.description}` : ''}`);
      }
      if (specialists.length) {
        doc.text(L.specialists);
        bulletList(doc, specialists);
      }
      if (followUp) doc.text(`${L.followUp} ${followUp}`);
    }

    const riskFactors = asStrings(cc?.riskFactors).length ? asStrings(cc?.riskFactors) : data.redFlags;
    const riskSeverity = asRecord(cc?.riskSeverity);
    if (riskFactors.length || riskSeverity) {
      sectionTitle(doc, L.sectionRiskFactors);
      if (riskSeverity) {
        doc.text(`${L.severity} ${riskSeverity.label ?? L.assessed}${riskSeverity.score != null ? ` (${riskSeverity.score}/${riskSeverity.max ?? 10})` : ''}`);
      }
      bulletList(doc, riskFactors);
    }

    if (typeof cc?.prognosisShort === 'string' || typeof cc?.prognosisLong === 'string') {
      sectionTitle(doc, L.sectionPrognosis);
      if (typeof cc.prognosisShort === 'string') {
        doc.text(L.shortTerm, { underline: true });
        bodyText(doc, cc.prognosisShort);
      }
      if (typeof cc.prognosisLong === 'string') {
        doc.text(L.longTerm, { underline: true });
        bodyText(doc, cc.prognosisLong);
      }
      const progFactors = asStrings(cc.prognosisFactors);
      if (progFactors.length) bulletList(doc, progFactors);
    }

    const dietGeneral = asStrings(cc?.dietGeneral);
    const diet = asRecord(cc?.dietByDiagnosis);
    const prevention = asStrings(cc?.preventionTips);
    if (dietGeneral.length || diet || prevention.length) {
      sectionTitle(doc, L.sectionDiet);
      if (dietGeneral.length) bulletList(doc, dietGeneral);
      if (diet) {
        if (typeof diet.diagnosis === 'string') doc.text(diet.diagnosis, { underline: true });
        const allowed = asStrings(diet.allowed);
        const restricted = asStrings(diet.restricted);
        if (allowed.length) doc.text(`${L.allowed} ${allowed.join('; ')}`, { width: 495 });
        if (restricted.length) doc.text(`${L.restricted} ${restricted.join('; ')}`, { width: 495 });
        if (typeof diet.notes === 'string') bodyText(doc, diet.notes);
      }
      if (prevention.length) {
        doc.text(L.prevention);
        bulletList(doc, prevention);
      }
    }

    const herbal = (cc?.herbalMedicine as unknown[]) ?? [];
    if (herbal.length) {
      sectionTitle(doc, L.sectionHerbal);
      doc.fontSize(8).fillColor('#64748b').text(L.herbalDisclaimer, { width: 495 });
      doc.fillColor('#0f172a').fontSize(10);
      herbal.forEach((item) => {
        const row = asRecord(item);
        if (!row) return;
        ensureSpace(doc, 30);
        doc.text(`• ${String(row.name ?? '')}`);
        if (typeof row.preparation === 'string') doc.fontSize(9).text(`  ${L.preparation} ${row.preparation}`);
        if (typeof row.caution === 'string') doc.fillColor('#b45309').text(`  ${L.caution} ${row.caution}`).fillColor('#0f172a');
        doc.fontSize(10);
      });
    }

    const quality = asRecord(cc?.qualityScore);
    if (quality?.overall != null) {
      sectionTitle(doc, L.sectionQuality);
      doc.text(`${L.overallScore} ${String(quality.overall)}/100`);
      if (typeof quality.notes === 'string') bodyText(doc, quality.notes);
    }

    const dataGaps = asStrings(cc?.dataGaps);
    if (dataGaps.length) {
      sectionTitle(doc, L.sectionDataGaps);
      bulletList(doc, dataGaps);
    }

    const recorded = asStrings(cc?.recordedFindings);
    if (recorded.length) {
      sectionTitle(doc, L.sectionRecorded);
      bulletList(doc, recorded);
    }

    const rejected = (cc?.rejectedHypotheses as unknown[]) ?? [];
    if (rejected.length) {
      sectionTitle(doc, L.sectionRejected);
      rejected.forEach((item) => {
        const row = asRecord(item);
        if (!row) return;
        ensureSpace(doc, 24);
        doc.text(`• ${String(row.name ?? '')}`);
        if (typeof row.reason === 'string') doc.fontSize(9).fillColor('#475569').text(row.reason, { width: 490 }).fontSize(10).fillColor('#0f172a');
      });
    }

    if (data.redFlags.length) {
      sectionTitle(doc, L.sectionRedFlags);
      bulletList(doc, data.redFlags);
    }

    addPageFooters(doc, locale);
    doc.end();
  });
}
