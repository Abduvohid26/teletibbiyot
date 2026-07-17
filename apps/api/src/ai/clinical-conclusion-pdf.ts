import PDFDocument from 'pdfkit';
import { BRAND } from '@ishifo/shared';

type DiagnosisRow = {
  name: string;
  icd10Code: string;
  confidence: number;
  reasoning: string;
};

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

function ensureSpace(doc: InstanceType<typeof PDFDocument>, needed = 60) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function sectionTitle(doc: InstanceType<typeof PDFDocument>, title: string) {
  ensureSpace(doc, 40);
  doc.moveDown(0.4);
  doc.fontSize(12).fillColor('#4f46e5').text(title, { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(10).fillColor('#0f172a');
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

function genderLabel(g?: string) {
  if (!g) return '—';
  const u = g.toUpperCase();
  if (u === 'MALE' || u === 'ERKAK') return 'Erkak';
  if (u === 'FEMALE' || u === 'AYOL') return 'Ayol';
  return g;
}

function fmtVital(v: number | undefined, unit: string) {
  return v != null && v > 0 ? `${v} ${unit}` : `— ${unit}`;
}

function addPageFooters(doc: InstanceType<typeof PDFDocument>) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - doc.page.margins.bottom + 10;
    doc.fontSize(7).fillColor('#64748b');
    doc.text(
      `${BRAND.name} | ${BRAND.domain} | Raqamli tizim yordamida shakllantirilgan. Faqat ma'lumot uchun.`,
      doc.page.margins.left,
      bottom,
      { width: 495, align: 'center', lineBreak: false },
    );
    doc.text(
      `Sahifa ${i - range.start + 1}/${range.count}`,
      doc.page.margins.left,
      bottom + 10,
      { width: 495, align: 'center', lineBreak: false },
    );
  }
  doc.fillColor('#0f172a');
}

export function buildAiAnalysisPdfBuffer(data: AiAnalysisPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cc = parseClinicalConclusion(data.rawResponse?.clinicalConclusion);
    const consensus = (cc?.consensusDiagnoses as unknown[]) ?? [];
    const alternatives = (cc?.alternativeDiagnoses as unknown[]) ?? [];
    const generatedAt = new Date().toLocaleDateString('uz-UZ');

    doc.fontSize(15).fillColor('#4f46e5').text('KONSILIUM: Yakuniy Klinik Xulosa', { align: 'center' });
    doc.fontSize(9).fillColor('#64748b').text(
      'Rasmiy tibbiy maslahat hujjati — doktor tavsiyasi sifatida. Faqat ma\'lumot uchun.',
      { align: 'center' },
    );
    doc.text(`Sana: ${generatedAt}`, { align: 'center' });
    doc.moveDown(0.6);

    sectionTitle(doc, 'BEMOR MA\'LUMOTLARI');
    doc.fontSize(10).fillColor('#0f172a');
    doc.text(`Bemor: ${data.patientName}`);
    if (data.patientAge != null) doc.text(`Yoshi: ${data.patientAge} yosh`);
    doc.text(`Jinsi: ${genderLabel(data.gender)}`);
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#334155').text('Ob\'ektiv:', { underline: true });
    doc.fillColor('#0f172a');
    if (data.weight != null) doc.text(`Tana vazni: ${data.weight} kg`);
    if (data.height != null) doc.text(`Bo'y: ${data.height} cm`);
    if (data.bmi != null) doc.text(`Tana massasi indeksi (TMI): ${data.bmi.toFixed(1)}`);
    const vs = data.vitalSigns ?? {};
    if (vs.bloodPressureSystolic && vs.bloodPressureDiastolic) {
      doc.text(`Arterial bosim: ${vs.bloodPressureSystolic}/${vs.bloodPressureDiastolic} mmHg`);
    }
    doc.text(`Yurak urishi (Puls): ${fmtVital(vs.heartRate, 'bpm')}`);
    doc.text(`Tana harorati: ${fmtVital(vs.temperature, '°C')}`);
    doc.text(`Saturatsiya (SpO2): ${fmtVital(vs.spo2, '%')}`);
    doc.text(`Nafas soni: ${fmtVital(vs.respiratoryRate, '/min')}`);
    doc.moveDown(0.2);
    if (data.complaints) doc.text(`Shikoyat: ${data.complaints}`);
    if (data.labResults) doc.text(`Laboratoriya: ${data.labResults}`);
    else doc.text('Laboratoriya: Laboratoriya va diagnostika natijalari fayl sifatida yuklandi.');
    if (data.anamnesisMorbi) doc.text(`Kasallik tarixi: ${data.anamnesisMorbi}`);
    if (data.medications) doc.text(`Dorilar: ${data.medications}`);
    doc.text(`UT: ${data.facilityName} (${data.facilityCode})`);
    if (data.doctorName) doc.text(`Shifokor: ${data.doctorName}`);
    doc.moveDown(0.4);

    sectionTitle(doc, 'Konsilium Konsensusi');
    if (consensus.length > 0) {
      sectionTitle(doc, 'Tashxislar');
      consensus.forEach((item, i) => {
        const row = asRecord(item);
        if (!row) return;
        ensureSpace(doc, 50);
        const conf = row.confidence != null ? ` ${String(row.confidence)}%` : '';
        const grade = typeof row.protocolReference === 'string' ? ` · ${row.protocolReference}` : '';
        doc.fontSize(11).fillColor('#0f172a').text(`${i + 1}. ${String(row.name ?? '')}${conf}${grade}`);
        doc.fontSize(10);
        if (row.icd10Code) doc.text(`MKB-10: ${String(row.icd10Code)}`);
        if (typeof row.justification === 'string') {
          doc.moveDown(0.1);
          doc.fontSize(9).fillColor('#475569').text(`Asoslash: ${row.justification}`, { width: 495 });
          doc.fillColor('#0f172a').fontSize(10);
        }
        const chain = asStrings(row.logicChain);
        if (chain.length) {
          doc.moveDown(0.15);
          doc.fontSize(9).text('Mantiqiy zanjir:', { underline: true });
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
      bodyText(doc, '—');
    }

    if (alternatives.length > 0) {
      sectionTitle(doc, 'Muqobil tashxis');
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
      sectionTitle(doc, 'Tegishli ilmiy maqolalar');
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
      sectionTitle(doc, 'Davolash Rejasi');
      treatmentSteps.forEach((step, i) => {
        ensureSpace(doc, 20);
        doc.text(`• qadam: ${step.replace(/^\d+\.\s*/, '')}`, { width: 490 });
      });
    }

    const medWarnings = asStrings(cc?.medicationWarnings);
    const medications = (cc?.medications as unknown[]) ?? [];
    if (medWarnings.length || medications.length) {
      sectionTitle(doc, 'Dori Tavsiyalari');
      if (medWarnings.length) {
        doc.fontSize(9).fillColor('#b45309').text('Farmakolog ogohlantirishlari:', { underline: true });
        doc.fillColor('#0f172a');
        bulletList(doc, medWarnings);
      }
      medications.forEach((item) => {
        const row = asRecord(item);
        if (!row) return;
        ensureSpace(doc, 36);
        doc.fontSize(10).text(String(row.name ?? ''));
        if (typeof row.dose === 'string') doc.text(`Doza: ${row.dose}`);
        if (typeof row.tradeNames === 'string') doc.text(`Mahalliy nomlar: ${row.tradeNames}`);
        if (typeof row.instructions === 'string') doc.fontSize(9).text(row.instructions, { width: 490 }).fontSize(10);
        doc.moveDown(0.2);
      });
    }

    const additionalTests = asStrings(cc?.additionalTests);
    const followUp = typeof cc?.followUp === 'string' ? cc.followUp : undefined;
    const routing = asRecord(cc?.patientRouting);
    const specialists = asStrings(cc?.recommendedSpecialists);
    if (additionalTests.length || followUp || routing || specialists.length) {
      sectionTitle(doc, 'Keyingi qadamlar rejasi');
      if (additionalTests.length) {
        doc.text('Qo\'shimcha tekshiruvlar:', { underline: true });
        bulletList(doc, additionalTests);
      }
      if (routing) {
        doc.text(`Yo'nalish: ${routing.level ?? ''}${routing.description ? ` — ${routing.description}` : ''}`);
      }
      if (specialists.length) {
        doc.text('Tavsiya etilgan mutaxassislar:');
        bulletList(doc, specialists);
      }
      if (followUp) doc.text(`Keyingi kuzatuv: ${followUp}`);
    }

    const riskFactors = asStrings(cc?.riskFactors).length ? asStrings(cc?.riskFactors) : data.redFlags;
    const riskSeverity = asRecord(cc?.riskSeverity);
    if (riskFactors.length || riskSeverity) {
      sectionTitle(doc, 'Xavf omillari');
      if (riskSeverity) {
        doc.text(`Holat og'irligi: ${riskSeverity.label ?? 'Baholangan'}${riskSeverity.score != null ? ` (${riskSeverity.score}/${riskSeverity.max ?? 10})` : ''}`);
      }
      bulletList(doc, riskFactors);
    }

    if (typeof cc?.prognosisShort === 'string' || typeof cc?.prognosisLong === 'string') {
      sectionTitle(doc, 'Kasallik prognozi');
      if (typeof cc.prognosisShort === 'string') {
        doc.text('Qisqa muddat (1–3 oy):', { underline: true });
        bodyText(doc, cc.prognosisShort);
      }
      if (typeof cc.prognosisLong === 'string') {
        doc.text('Uzoq muddat (1–5 yil):', { underline: true });
        bodyText(doc, cc.prognosisLong);
      }
      const progFactors = asStrings(cc.prognosisFactors);
      if (progFactors.length) bulletList(doc, progFactors);
    }

    const dietGeneral = asStrings(cc?.dietGeneral);
    const diet = asRecord(cc?.dietByDiagnosis);
    const prevention = asStrings(cc?.preventionTips);
    if (dietGeneral.length || diet || prevention.length) {
      sectionTitle(doc, 'To\'g\'ri ovqatlanish va kasalliklarni oldini olish (profilaktika)');
      if (dietGeneral.length) bulletList(doc, dietGeneral);
      if (diet) {
        if (typeof diet.diagnosis === 'string') doc.text(diet.diagnosis, { underline: true });
        const allowed = asStrings(diet.allowed);
        const restricted = asStrings(diet.restricted);
        if (allowed.length) doc.text(`Ruxsat: ${allowed.join('; ')}`, { width: 495 });
        if (restricted.length) doc.text(`Cheklangan: ${restricted.join('; ')}`, { width: 495 });
        if (typeof diet.notes === 'string') bodyText(doc, diet.notes);
      }
      if (prevention.length) {
        doc.text('Profilaktika:');
        bulletList(doc, prevention);
      }
    }

    const herbal = (cc?.herbalMedicine as unknown[]) ?? [];
    if (herbal.length) {
      sectionTitle(doc, 'Xalq tabobati va dorivor o\'simliklar (qo\'shimcha)');
      doc.fontSize(8).fillColor('#64748b').text('Rasmiy dori va shifokor ko\'rsatmasining o\'rnini bosmaydi.', { width: 495 });
      doc.fillColor('#0f172a').fontSize(10);
      herbal.forEach((item) => {
        const row = asRecord(item);
        if (!row) return;
        ensureSpace(doc, 30);
        doc.text(`• ${String(row.name ?? '')}`);
        if (typeof row.preparation === 'string') doc.fontSize(9).text(`  Tayyorlash: ${row.preparation}`);
        if (typeof row.caution === 'string') doc.fillColor('#b45309').text(`  Ehtiyot: ${row.caution}`).fillColor('#0f172a');
        doc.fontSize(10);
      });
    }

    const quality = asRecord(cc?.qualityScore);
    if (quality?.overall != null) {
      sectionTitle(doc, 'Tibbiy yordam sifati (protokol asosida)');
      doc.text(`Umumiy ball: ${String(quality.overall)}/100`);
      if (typeof quality.notes === 'string') bodyText(doc, quality.notes);
    }

    const recorded = asStrings(cc?.recordedFindings);
    if (recorded.length) {
      sectionTitle(doc, 'Kartada qayd etilgan ma\'lumotlar');
      bulletList(doc, recorded);
    }

    const rejected = (cc?.rejectedHypotheses as unknown[]) ?? [];
    if (rejected.length) {
      sectionTitle(doc, 'Rad Etilgan Gipotezalar');
      rejected.forEach((item) => {
        const row = asRecord(item);
        if (!row) return;
        ensureSpace(doc, 24);
        doc.text(`• ${String(row.name ?? '')}`);
        if (typeof row.reason === 'string') doc.fontSize(9).fillColor('#475569').text(row.reason, { width: 490 }).fontSize(10).fillColor('#0f172a');
      });
    }

    if (data.redFlags.length) {
      sectionTitle(doc, 'Qizil bayroqlar');
      bulletList(doc, data.redFlags);
    }

    addPageFooters(doc);
    doc.end();
  });
}
