import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TriageLevel, UserRole, Prisma, ConsultationStatus } from '@prisma/client';
import { MT_NOTIFY_ROLES } from '../common/roles.constants';
import { BRAND } from '@ishifo/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { VideoGateway } from '../video/video.gateway';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { FieldCryptoService } from '../common/field-crypto.service';
import { StorageService } from '../storage/storage.service';
import { buildAiAnalysisPdfBuffer } from './clinical-conclusion-pdf';
import { normalizePdfLocale, type PdfLocale } from './pdf-labels';

const SYSTEM_PROMPT = `Siz ${BRAND.name} platformasining AI-yordamchi shifokorisiz (telemedicine konsilium yordamchisi).
MUHIM: Siz HECH QACHON yakuniy, rasmiy tibbiy tashxis qo'ymaysiz — bu faqat AI konsensus xulosasi.
O'zbekiston SSV klinik protokollari, MKB-10 va dalillarga asoslangan tibbiyot (EBM) asosida yozing.
{LANG_RULE}

════════════════════════════════════════════════════════
HAJM TALABI (majburiy) — hozirgi qisqa xulosadan 2–3 baravar batafsil:
════════════════════════════════════════════════════════
- summary: kamida 5–8 jumla (shikoyat → anamnez/vitals → asosiy xavf → farqlash → keyingi qadam).
- mainConclusion: kamida 8–12 jumla. Kritik topilmalar, nima uchun shu xulosa, nima shoshilinch,
  nima ambulator kuzatuvda qolishi mumkinligini aniq yozing.
- Har bir consensusDiagnoses.justification: kamida 4–7 jumla (klinik mezonlar, raqamlar: BMI, BP, HR, SpO2...).
- Har bir consensusDiagnoses.logicChain: kamida 5–8 qadam (har biri to'liq jumla).
- alternativeDiagnoses: kamida 2–4 ta (agar klinik jihatdan mos bo'lsa); har birining justification ≥ 2–3 jumla.
- treatmentSteps: kamida 5–8 aniq qadam (vaqt, nazorat, qachon qayta baholash).
- recommendations (yuqori daraja): kamida 5–8 band.
- additionalTests: kamida 3–6 ta, har biri "nima + nima uchun + qachon" formatida.
- medications: agar dori tavsiya qilinsa — doza, davomiylik, ogohlantirish bilan (3–6 ta gacha).
- dietGeneral / preventionTips: har biri kamida 4–6 amaliy band.
- prognosisShort va prognosisLong: har biri kamida 3–5 jumla.
- riskFactors: kamida 3–6 ta; recordedFindings: kartadagi barcha muhim faktlar (5+ bo'lishi mumkin).
- scientificArticles: 1–3 ta haqiqiy manba. Havola qoidalari pastda — soxta URL qat'iy taqiqlanadi.
- qualityScore.notes: 2–4 jumla — qaysi ma'lumot yetarli/yetishmayotganini yozing.
- dataGaps: kamida 2–5 ta — xulosaga ta'sir qiluvchi yetishmayotgan ma'lumotlar.

════════════════════════════════════════════════════════
ISHONCH DARAJASINI KALIBRLASH (majburiy)
════════════════════════════════════════════════════════
confidence — bu "qanchalik ishonaman", va u MAVJUD DALILGA bog'liq bo'lishi shart.
Faqat shikoyat va anamnez asosida yuqori foiz qo'yish — QO'POL XATO.

- 80–95%: obyektiv tasdiq bor (laborator/instrumental natija, ko'rik topilmasi yoki
  biriktirilgan hujjat tahlili tashxisni bevosita tasdiqlaydi).
- 60–79%: xarakterli klinik manzara + qisman obyektiv ma'lumot (vitals yoki ko'rik), lekin
  tasdiqlovchi tekshiruv yo'q.
- 40–59%: faqat shikoyat + anamnez mos keladi, obyektiv tasdiq umuman yo'q. TIPIK HOLAT —
  telemeditsina murojaatlarining ko'pchiligi shu darajaga tushadi.
- 20–39%: ma'lumot juda kam yoki bir nechta tashxis bir xil darajada mumkin.

Agar tasdiqlovchi tekshiruv yo'q bo'lsa, 60% dan yuqori qo'ymang.
Agar 60% dan yuqori qo'ysangiz — justification ichida QAYSI obyektiv dalil buni oqlashini
aniq nomlang. Nomlay olmasangiz — foizni pasaytiring.
Bitta tashxis 60% dan past bo'lsa — alternativeDiagnoses majburiy va jiddiy bo'lishi kerak.

qualityScore.overall ham shu mantiqqa bo'ysunadi: ko'rik va tekshiruv natijalari yo'q bo'lsa,
u 60 dan oshmasligi kerak.

════════════════════════════════════════════════════════
MANBALAR — SOXTA HAVOLA QAT'IY TAQIQLANADI
════════════════════════════════════════════════════════
URL ni HECH QACHON o'ylab topmang, taxmin qilmang yoki "shunday bo'lishi kerak" deb yozmang.
Mavjud bo'lmagan havola shifokorni chalg'itadi — bu havolasiz manbadan ANCHA yomon.

url maydonini FAQAT quyidagi barqaror manbalar uchun to'ldiring va faqat aniq bilsangiz:
  - PubMed: https://pubmed.ncbi.nlm.nih.gov/<PMID>/   (PMID ni aniq bilsangiz)
  - DOI:    https://doi.org/<doi>                      (DOI ni aniq bilsangiz)
  - WHO, Cochrane Library, NICE, UpToDate — barqaror sahifalar

ssv.uz, lex.uz va shunga o'xshash milliy manbalar uchun CHUQUR HAVOLA YOZMANG —
faqat hujjat NOMINI va yilini yozing, url ni bermang.
Aniq manbani nomlay olmasangiz — sourceType: "general" qo'ying va url bermang.

Har bir manba uchun sourceType majburiy:
  "protocol"  — milliy/vazirlik klinik protokoli (aniq nomi bilan)
  "guideline" — xalqaro klinik ko'rsatma (WHO, NICE, GINA, ...)
  "article"   — ilmiy maqola (PubMed/DOI bilan)
  "general"   — umumiy tibbiy amaliyot, aniq hujjat ko'rsatilmagan

protocolReference uchun ham xuddi shu qoida: aniq hujjat nomi va yilini yozing.
Aniq hujjat bo'lmasa — "Umumiy klinik amaliyot (aniq protokol havolasi yo'q)" deb yozing.

════════════════════════════════════════════════════════
YETISHMAYOTGAN MA'LUMOT
════════════════════════════════════════════════════════
dataGaps — xulosani o'zgartirishi mumkin bo'lgan yetishmayotgan ma'lumotlarni sanang
(ko'rik topilmalari, tahlil natijalari, shikoyat davomiyligi, oldingi davolash va h.k.).
Har biri "nima yetishmayapti — nega muhim" formatida. Kamida 2–5 ta.
mainConclusion ning oxirida ham shu cheklovni ochiq aytib o'ting.

SOXTA MA'LUMOT TAQIQLANADI:
Faqat bemorning haqiqiy shikoyatlari, anamnezi, vital belgilari va biriktirilgan hujjat tahlillari asosida yozing.
Hujjat/attachment findings bo'lsa — ularni asoslash va mantiqiy zanjirga aniq bog'lang.
Klinik asos bo'lmagan bo'limni to'qib to'ldirmang (bo'sh massiv yoki o'tkazib yuboring).
Lekin asosiy bo'limlar (summary, mainConclusion, consensusDiagnoses, treatmentSteps, additionalTests,
recommendations, riskFactors, prognosis*, qualityScore, recordedFindings) — MAVJUD ma'lumotlar
doirasida maksimal chuqurlikda yozilsin (yuqoridagi hajm talabiga rioya qiling).

Javobni faqat quyidagi JSON formatida bering:
{
  "summary": "batafsil asosiy klinik xulosa (5-8 jumla)",
  "diagnoses": [{"name": "...", "icd10Code": "...", "confidence": 0-100, "reasoning": "3-5 jumla"}],
  "triageLevel": "LOW|MEDIUM|HIGH|EMERGENCY",
  "recommendations": ["..."],
  "redFlags": ["..."],
  "clinicalConclusion": {
    "mainConclusion": "8-12 jumlalik konsensus xulosa",
    "consensusDiagnoses": [{
      "name": "asosiy tashxis",
      "icd10Code": "E66.9",
      "confidence": 94,
      "protocolReference": "aniq hujjat nomi + yil, yoki 'Umumiy klinik amaliyot (aniq protokol havolasi yo'q)'",
      "evidenceLevel": "confirmed|probable|possible",
      "justification": "4-7 jumlalik asoslash",
      "logicChain": ["1-qadam...", "2-qadam...", "3-qadam...", "4-qadam...", "5-qadam..."]
    }],
    "alternativeDiagnoses": [{"name": "...", "icd10Code": "...", "confidence": 20, "justification": "2-3 jumla"}],
    "scientificArticles": [{"title": "manba/hujjat aniq nomi", "sourceType": "protocol|guideline|article|general", "url": "faqat PubMed/DOI/WHO — aniq bilsangiz, aks holda bu maydonni umuman bermang", "description": "2-3 jumla nima uchun tegishli"}],
    "dataGaps": ["Nima yetishmayapti — nega muhim"],
    "treatmentSteps": ["qadam: ..."],
    "medicationWarnings": ["DDI / kontrendikatsiya..."],
    "medications": [{"name": "...", "dose": "...", "tradeNames": "O'zbekistonda mavjud", "instructions": "batafsil", "diagnosis": "..."}],
    "additionalTests": ["Tekshiruv — nima uchun — qachon"],
    "patientRouting": {"level": "Ambulator|Statsionar|Shoshilinch", "description": "2-4 jumla"},
    "recommendedSpecialists": ["Mutaxassis — nima uchun"],
    "followUp": "qachon / qanday nazorat (2-3 jumla)",
    "riskFactors": ["..."],
    "riskSeverity": {"label": "Past|O'rtacha|Yuqori", "score": 5, "max": 10},
    "prognosisShort": "1-3 oy (3-5 jumla)",
    "prognosisLong": "1-5 yil (3-5 jumla)",
    "prognosisFactors": ["..."],
    "dietGeneral": ["..."],
    "dietByDiagnosis": {"diagnosis": "...", "allowed": ["..."], "restricted": ["..."], "notes": "2-3 jumla"},
    "preventionTips": ["..."],
    "herbalMedicine": [{"name": "...", "part": "...", "preparation": "...", "context": "...", "caution": "..."}],
    "qualityScore": {"overall": 70, "notes": "2-4 jumla — ma'lumot sifati"},
    "rejectedHypotheses": [{"name": "...", "reason": "1-2 jumla"}],
    "recordedFindings": ["Kartada qayd etilgan fakt..."]
  }
}

diagnoses massivida eng yuqori ishonchli tashxis birinchi.`;

const CHAT_SYSTEM_PROMPT = `Siz ${BRAND.name} telemedicine platformasining AI klinik yordamchisisiz.
Shifokor sizga bemorning AI klinik xulosasi haqida qo'shimcha savollar beradi.
{LANG_RULE}
Javob: aniq, BATAFSIL (kamida 2–3 paragraf yoki 8–15 jumla), professional tibbiy uslubda.
Struktura: 1) qisqa javob, 2) klinik asoslash, 3) differensial / xavf, 4) amaliy tavsiyalar, 5) qo'shimcha tekshiruvlar.
MUHIM: Yakuniy rasmiy tashxis qo'ymang — faqat AI maslahati.
Klinik xulosa kontekstidan foydalaning. Ma'lumot yetarli bo'lmasa — qaysi tekshiruv kerakligini aniq yozing.

DALIL VA MANBA:
Ehtimollik yoki foiz aytsangiz — u qaysi dalilga tayanishini aynan ko'rsating.
Obyektiv tasdiq (tahlil, ko'rik, hujjat) bo'lmasa, buni ochiq ayting va yuqori ishonch bildirmang.
Manba keltirsangiz — hujjat/ko'rsatma nomini va yilini yozing.
URL ni HECH QACHON o'ylab topmang: PMID/DOI ni aniq bilmasangiz, havolasiz faqat nomini yozing.

Markdown ishlatmang — oddiy matn.`;

/**
 * Havolasi tekshirib bo'lmaydigan manbalardan URL ni olib tashlaydi.
 *
 * Modellar ssv.uz / lex.uz kabi milliy saytlarga mavjud bo'lmagan chuqur havolalarni
 * o'ylab topishga moyil. Ishlamaydigan havola shifokorni chalg'itadi, shuning uchun
 * faqat barqaror va identifikator asosidagi manbalar (PubMed PMID, DOI, WHO, Cochrane,
 * NICE) saqlanadi — qolganlarida manba nomi qoladi, URL tushiriladi.
 */
const TRUSTED_SOURCE_HOSTS = [
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'doi.org',
  'dx.doi.org',
  'who.int',
  'icd.who.int',
  'cochranelibrary.com',
  'nice.org.uk',
  'uptodate.com',
];

function isTrustedSourceUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    const host = hostname.replace(/^www\./, '').toLowerCase();
    return TRUSTED_SOURCE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function sanitizeSourceUrls<T extends OpenAiAnalysisResult>(result: T): T {
  const cc = (result as Record<string, unknown>).clinicalConclusion;
  if (!cc || typeof cc !== 'object') return result;

  const articles = (cc as Record<string, unknown>).scientificArticles;
  if (!Array.isArray(articles)) return result;

  const cleaned = articles.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const article = item as Record<string, unknown>;
    if (typeof article.url !== 'string' || isTrustedSourceUrl(article.url)) return article;
    const { url: _dropped, ...rest } = article;
    return rest;
  });

  return {
    ...result,
    clinicalConclusion: { ...(cc as Record<string, unknown>), scientificArticles: cleaned },
  } as T;
}

type AiLocale = 'uz' | 'ru' | 'en';

function normalizeAiLocale(value: unknown): AiLocale {
  if (value === 'ru' || value === 'en' || value === 'uz') return value;
  if (typeof value === 'string') {
    const base = value.toLowerCase().split('-')[0];
    if (base === 'ru' || base === 'en' || base === 'uz') return base;
  }
  return 'uz';
}

function langRuleFor(locale: AiLocale): string {
  if (locale === 'ru') {
    return 'Все текстовые поля ответа (summary, clinicalConclusion и т.д.) пишите ТОЛЬКО на русском языке, профессиональным клиническим стилем. Не смешивайте языки.';
  }
  if (locale === 'en') {
    return 'Write ALL text fields in the response (summary, clinicalConclusion, etc.) ONLY in English, professional clinical style. Do not mix languages.';
  }
  return "Barcha matnlar o'zbek tilida, professional klinik uslubda bo'lsin. Tillarni aralashtirmang.";
}

function withLang(prompt: string, locale: AiLocale): string {
  return prompt.replace('{LANG_RULE}', langRuleFor(locale));
}

interface OpenAiAnalysisResult {
  summary: string;
  diagnoses: Array<{ name: string; icd10Code: string; confidence: number; reasoning: string }>;
  triageLevel: string;
  recommendations: string[];
  redFlags: string[];
  clinicalConclusion?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Kalendarga asoslangan aniq yosh (yil) hisobi. */
export function calculateAge(birthDate: Date): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notifications: NotificationsService,
    private videoGateway: VideoGateway,
    private access: AccessControlService,
    private crypto: FieldCryptoService,
    private storage: StorageService,
  ) {}

  async analyzeConsultation(consultationId: string, localeRaw?: string): Promise<unknown> {
    const locale = normalizeAiLocale(localeRaw);
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        clinicalRecord: true,
        patient: true,
        attachments: {
          where: { aiAnalysisStatus: 'DONE' },
          select: {
            fileName: true,
            fileType: true,
            aiFindings: true,
          },
          take: 12,
        },
      },
    });

    if (!consultation?.clinicalRecord) return;

    const steps = [
      { order: 2, step: 'SYMPTOM_ANALYSIS' },
      { order: 3, step: 'DIFFERENTIAL_DIAGNOSIS' },
      { order: 4, step: 'RISK_ASSESSMENT' },
      { order: 5, step: 'RECOMMENDATION_GENERATION' },
    ];

    for (const s of steps) {
      await this.updateStep(consultationId, s.step, 'IN_PROGRESS');
      await this.delay(800);
      await this.updateStep(consultationId, s.step, 'DONE');
    }

    const attachmentFindings = consultation.attachments.map((a) => {
      const findings = a.aiFindings as {
        documentType?: string;
        findings?: string[];
        abnormalities?: string[];
        impression?: string;
      } | null;
      return {
        fileName: a.fileName,
        fileType: a.fileType,
        documentType: findings?.documentType,
        findings: findings?.findings || [],
        abnormalities: findings?.abnormalities || [],
        impression: findings?.impression,
      };
    });

    const clinicalData = this.deidentifyClinicalData({
      complaints: consultation.clinicalRecord.complaints,
      anamnesisMorbi: consultation.clinicalRecord.anamnesisMorbi,
      anamnesisVitae: consultation.clinicalRecord.anamnesisVitae,
      medications: consultation.clinicalRecord.medications,
      allergies: consultation.clinicalRecord.allergies,
      weight: consultation.clinicalRecord.weight,
      height: consultation.clinicalRecord.height,
      bmi: consultation.clinicalRecord.bmi,
      vitalSigns: consultation.clinicalRecord.vitalSigns,
      familyHistory: consultation.clinicalRecord.familyHistory,
      socialHistory: consultation.clinicalRecord.socialHistory,
      ageYears: calculateAge(consultation.patient.birthDate),
      gender: consultation.patient.gender,
      ...(attachmentFindings.length
        ? { attachmentAnalyses: attachmentFindings }
        : {}),
    });

    let result = await this.callOpenAiAnalysis(clinicalData, locale);
    if (!result) {
      await this.saveUnavailableAnalysis(consultationId);
      return { aiUnavailable: true };
    }

    // Model o'ylab topgan havolalarni olib tashlaymiz — nomi qoladi, soxta URL emas
    result = sanitizeSourceUrls(result);

    const triageLevel = result.triageLevel as TriageLevel;
    const rawResponse = {
      ...result,
      contentLocale: locale,
    } as Prisma.InputJsonValue;

    await this.prisma.aiAnalysis.upsert({
      where: { consultationId },
      create: {
        consultationId,
        summary: result.summary,
        diagnoses: result.diagnoses,
        triageLevel,
        recommendations: result.recommendations,
        redFlags: result.redFlags,
        rawResponse,
      },
      update: {
        summary: result.summary,
        diagnoses: result.diagnoses,
        triageLevel,
        recommendations: result.recommendations,
        redFlags: result.redFlags,
        rawResponse,
      },
    });

    await this.prisma.consultation.update({
      where: { id: consultationId },
      data: { triageLevel },
    });

    this.videoGateway.emitConsultationEvent(consultationId, 'ai-analysis-updated', { consultationId });

    if (triageLevel === 'EMERGENCY' || (result.redFlags?.length ?? 0) > 0) {
      await this.prisma.auditLog.create({
        data: {
          action: 'AI_RED_FLAG_ALERT',
          entity: 'Consultation',
          entityId: consultationId,
          details: { redFlags: result.redFlags, triageLevel },
        },
      });

      const updatedConsultation = await this.prisma.consultation.findUnique({
        where: { id: consultationId },
        include: { patient: true, utFacility: true },
      });
      if (updatedConsultation && triageLevel === 'EMERGENCY') {
        const doctors = await this.prisma.user.findMany({
          where: { role: { in: MT_NOTIFY_ROLES }, isActive: true },
          select: { email: true, id: true },
        });
        if (doctors.length) {
          this.notifications
            .notifyEmergencyTriage(
              doctors.map((d) => d.email),
              updatedConsultation.patient.fullName,
              updatedConsultation.utFacility.code,
              doctors.map((d) => d.id),
              consultationId,
            )
            .catch((err) => this.logger.warn(`Emergency bildirishnoma xatosi: ${err}`));
        }
      }
    }

    return result;
  }

  private getOpenAiConfig() {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'your-openai-api-key-here') return null;
    return {
      apiKey,
      model: this.config.get('OPENAI_MODEL') || 'gpt-4o-mini',
    };
  }

  private async callOpenAiChat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: { maxTokens?: number; json?: boolean; systemPrompt?: string },
  ): Promise<string | null> {
    const cfg = this.getOpenAiConfig();
    if (!cfg) return null;

    try {
      const systemContent = options?.systemPrompt ?? SYSTEM_PROMPT;
      const chatMessages = [{ role: 'system' as const, content: systemContent }, ...messages];

      const body: Record<string, unknown> = {
        model: cfg.model,
        max_tokens: options?.maxTokens ?? 4096,
        messages: chatMessages,
        temperature: 0.2,
      };
      if (options?.json) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.warn(`OpenAI API xatoligi (${response.status}): ${errText.slice(0, 300)}`);
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? null;
    } catch (err) {
      this.logger.warn(`OpenAI ulanish xatoligi: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  private async callOpenAiAnalysis(
    clinicalData: Record<string, unknown>,
    locale: AiLocale = 'uz',
  ): Promise<OpenAiAnalysisResult | null> {
    const text = await this.callOpenAiChat(
      [
        {
          role: 'user',
          content:
            `Quyidagi klinik ma'lumotlarni CHUQUR tahlil qiling.\n`
            + `Talab: matn hajmi oldingi qisqa xulosadan 2–3 baravar ko'p bo'lsin `
            + `(summary 5–8 jumla, mainConclusion 8–12 jumla, har tashxis asoslashi 4–7 jumla, `
            + `logicChain 5–8 qadam, treatmentSteps 5–8, additionalTests 3–6).\n`
            + `Faqat JSON obyekt qaytaring:\n${JSON.stringify(clinicalData, null, 2)}`,
        },
      ],
      { json: true, maxTokens: 12288, systemPrompt: withLang(SYSTEM_PROMPT, locale) },
    );

    if (!text) return null;

    try {
      const parsed = JSON.parse(text) as OpenAiAnalysisResult;
      if (!parsed.summary || !parsed.triageLevel) return null;
      return parsed;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      try {
        return JSON.parse(jsonMatch[0]) as OpenAiAnalysisResult;
      } catch {
        return null;
      }
    }
  }

  private async saveUnavailableAnalysis(consultationId: string) {
    await this.prisma.aiAnalysis.upsert({
      where: { consultationId },
      create: {
        consultationId,
        summary: 'AI tahlil xizmati vaqtincha mavjud emas. Shifokor mustaqiy baholash o\'tkazishi kerak.',
        diagnoses: [],
        triageLevel: 'MEDIUM',
        recommendations: ['AI xizmati offline — qo\'lda klinik baholash talab qilinadi'],
        redFlags: [],
        rawResponse: { aiUnavailable: true },
      },
      update: {
        summary: 'AI tahlil xizmati vaqtincha mavjud emas.',
        diagnoses: [],
        rawResponse: { aiUnavailable: true },
      },
    });
    await this.prisma.consultation.update({
      where: { id: consultationId },
      data: { triageLevel: 'MEDIUM' },
    });
    this.videoGateway.emitConsultationEvent(consultationId, 'ai-analysis-updated', { consultationId });
  }

  /** AI klinik xulosasini PDF formatida */
  async buildAnalysisPdf(
    consultationId: string,
    user: AuthUser,
    localeRaw?: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const locale = normalizePdfLocale(localeRaw);
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: true,
        utFacility: true,
        mtDoctor: true,
        aiAnalysis: true,
        clinicalRecord: true,
      },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);
    if (!consultation.aiAnalysis) throw new NotFoundException('AI tahlil topilmadi');

    const fileName = this.pdfFileName(consultationId, locale);
    const cachedKey = this.pdfFileKey(consultationId, locale);
    try {
      const { buffer } = await this.storage.getObjectBuffer(cachedKey);
      return { buffer, fileName };
    } catch {
      /* generate on demand */
    }

    if (locale === 'uz') {
      try {
        const legacy = await this.storage.getObjectBuffer(this.legacyPdfFileKey(consultationId));
        return { buffer: legacy.buffer, fileName: `tashxis-${consultationId.slice(0, 8)}.pdf` };
      } catch {
        /* ignore */
      }
    }

    const buffer = await this.buildAnalysisPdfBufferForConsultation(consultation, locale);
    return { buffer, fileName };
  }

  /** Yakunlashda UT operator uchun tashxis PDF saqlash (3 til) */
  /**
   * Konsilium PDF sini uch tilda tayyorlaydi.
   *
   * `primaryLocale` — shifokorning interfeys tili: u SINXRON generatsiya qilinadi va
   * hisobot yozuvi shu tilga bog'lanadi. Qolgan ikki til fonda tayyorlanadi, chunki
   * har biri LLM tarjimasini talab qiladi va yakunlashni bir necha o'n soniyaga cho'zadi.
   */
  async persistAnalysisReport(
    consultationId: string,
    generatedById?: string,
    primaryLocaleRaw?: string,
  ): Promise<void> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: true,
        utFacility: true,
        mtDoctor: true,
        aiAnalysis: true,
        clinicalRecord: true,
      },
    });
    if (!consultation?.aiAnalysis) {
      this.logger.warn(`Tashxis PDF: AI tahlil yo'q (${consultationId})`);
      return;
    }

    const primaryLocale = normalizePdfLocale(primaryLocaleRaw);
    await this.buildAndStoreLocalePdf(consultation, primaryLocale);

    // Qolgan tillar fonda — shifokor kutib turmasin
    const rest = (['uz', 'ru', 'en'] as PdfLocale[]).filter((l) => l !== primaryLocale);
    void (async () => {
      for (const locale of rest) {
        try {
          await this.buildAndStoreLocalePdf(consultation, locale);
        } catch (err) {
          this.logger.warn(`Tashxis PDF (${locale}) tayyorlanmadi (${consultationId}): ${err}`);
        }
      }
    })();

    const fileName = this.pdfFileName(consultationId, primaryLocale);
    const fileKey = this.pdfFileKey(consultationId, primaryLocale);

    await this.prisma.consultationReport.upsert({
      where: { consultationId },
      create: {
        consultationId,
        fileKey,
        fileName,
        generatedById,
      },
      update: {
        fileKey,
        fileName,
        generatedAt: new Date(),
        generatedById,
      },
    });

    const utOperators = await this.prisma.user.findMany({
      where: { role: UserRole.UT_OPERATOR, facilityId: consultation.utId, isActive: true },
      select: { id: true },
    });
    if (utOperators.length) {
      const p = this.crypto.unprotectPatient(consultation.patient as Record<string, unknown>) as typeof consultation.patient;
      await this.notifications.notifyReportReady(
        utOperators.map((u) => u.id),
        p.fullName,
        consultationId,
      );
    }
  }

  /** Bitta til uchun tarjima snapshotini tayyorlab, PDF ni saqlaydi */
  private async buildAndStoreLocalePdf(
    consultation: Parameters<AiService['buildAnalysisPdfBufferForConsultation']>[0] & { id: string },
    locale: PdfLocale,
  ): Promise<void> {
    // Tarjima snapshotini buildAnalysisPdfBufferForConsultation ning o'zi ta'minlaydi
    const buffer = await this.buildAnalysisPdfBufferForConsultation(consultation, locale);
    await this.storage.uploadBuffer(this.pdfFileKey(consultation.id, locale), buffer, 'application/pdf');
  }

  /**
   * Tahlilni so'ralgan tilga o'giradi (kerak bo'lsa tarjima qilib, snapshotni saqlaydi)
   * va shu tildagi variantni qaytaradi. Interfeys tili almashganda ishlatiladi.
   */
  async localizeAnalysis(consultationId: string, localeRaw?: string) {
    const locale = normalizePdfLocale(localeRaw);
    await this.ensureAnalysisLocaleSnapshot(consultationId, locale);

    const analysis = await this.prisma.aiAnalysis.findUnique({ where: { consultationId } });
    if (!analysis) throw new NotFoundException('AI tahlil topilmadi');

    const resolved = this.resolveAnalysisForLocale(analysis, locale);
    return { ...resolved, id: analysis.id, contentLocale: locale };
  }

  private pdfFileName(consultationId: string, locale: PdfLocale): string {
    return `tashxis-${consultationId.slice(0, 8)}-${locale}.pdf`;
  }

  private pdfFileKey(consultationId: string, locale: PdfLocale): string {
    return `reports/${consultationId}/${this.pdfFileName(consultationId, locale)}`;
  }

  private legacyPdfFileKey(consultationId: string): string {
    return `reports/${consultationId}/tashxis-${consultationId.slice(0, 8)}.pdf`;
  }

  private async ensureAnalysisLocaleSnapshot(consultationId: string, targetLocale: PdfLocale): Promise<void> {
    const analysis = await this.prisma.aiAnalysis.findUnique({ where: { consultationId } });
    if (!analysis) return;

    const raw = (analysis.rawResponse as Record<string, unknown>) || {};
    const contentLocale = normalizeAiLocale(raw.contentLocale);
    if (contentLocale === targetLocale) return;

    const snapshots = (raw.localeSnapshots as Record<string, unknown>) || {};
    if (snapshots[targetLocale]) return;

    const langNames: Record<PdfLocale, string> = { uz: "o'zbek", ru: 'rus', en: 'English' };
    const payload = {
      summary: analysis.summary,
      diagnoses: analysis.diagnoses,
      recommendations: analysis.recommendations,
      redFlags: analysis.redFlags,
      clinicalConclusion: raw.clinicalConclusion,
    };

    const text = await this.callOpenAiChat(
      [{
        role: 'user',
        content:
          `Translate this clinical AI analysis JSON from ${langNames[contentLocale]} to ${langNames[targetLocale]}. `
          + 'Keep ICD-10 codes, numbers, URLs, and protocol references unchanged. '
          + 'Return ONLY valid JSON with keys: summary, diagnoses, recommendations, redFlags, clinicalConclusion (same nested structure).\n\n'
          + JSON.stringify(payload),
      }],
      {
        json: true,
        maxTokens: 12288,
        systemPrompt: `You are a medical translator. Output professional clinical ${langNames[targetLocale]}. JSON only.`,
      },
    );

    if (!text) {
      this.logger.warn(`PDF locale ${targetLocale}: translation failed for ${consultationId}`);
      return;
    }

    try {
      const translated = JSON.parse(text) as Record<string, unknown>;
      await this.prisma.aiAnalysis.update({
        where: { consultationId },
        data: {
          rawResponse: {
            ...raw,
            localeSnapshots: {
              ...snapshots,
              [targetLocale]: translated,
            },
          } as Prisma.InputJsonValue,
        },
      });
    } catch {
      this.logger.warn(`PDF locale ${targetLocale}: invalid translation JSON for ${consultationId}`);
    }
  }

  private resolveAnalysisForLocale(
    analysis: {
      summary: string;
      triageLevel: string;
      diagnoses: unknown;
      recommendations: unknown;
      redFlags: unknown;
      rawResponse: unknown;
    },
    locale: PdfLocale,
  ) {
    const raw = (analysis.rawResponse as Record<string, unknown>) || {};
    const contentLocale = normalizeAiLocale(raw.contentLocale);
    if (contentLocale === locale) return analysis;

    const snap = (raw.localeSnapshots as Record<string, Record<string, unknown>> | undefined)?.[locale];
    if (!snap) return analysis;

    return {
      ...analysis,
      summary: typeof snap.summary === 'string' ? snap.summary : analysis.summary,
      diagnoses: snap.diagnoses ?? analysis.diagnoses,
      recommendations: snap.recommendations ?? analysis.recommendations,
      redFlags: snap.redFlags ?? analysis.redFlags,
      rawResponse: {
        ...raw,
        clinicalConclusion: snap.clinicalConclusion ?? raw.clinicalConclusion,
      },
    };
  }

  private async buildAnalysisPdfBufferForConsultation(
    consultation: {
      id: string;
      patient: { fullName: string; phone: string | null; birthDate: Date; gender: string };
      utFacility: { name: string; code: string };
      mtDoctor?: { fullName: string } | null;
      aiAnalysis: {
        summary: string;
        triageLevel: string;
        diagnoses: unknown;
        recommendations: unknown;
        redFlags: unknown;
        rawResponse: unknown;
      } | null;
      clinicalRecord?: {
        complaints: string;
        anamnesisMorbi: string;
        medications: string | null;
        labResults: string | null;
        weight: number | null;
        height: number | null;
        bmi: number | null;
        vitalSigns: unknown;
      } | null;
    },
    locale: PdfLocale = 'uz',
  ): Promise<Buffer> {
    const analysis = consultation.aiAnalysis;
    if (!analysis) throw new NotFoundException('AI tahlil topilmadi');

    await this.ensureAnalysisLocaleSnapshot(consultation.id, locale);
    const fresh = await this.prisma.aiAnalysis.findUnique({ where: { consultationId: consultation.id } });
    const resolved = this.resolveAnalysisForLocale(fresh ?? analysis, locale);

    const p = this.crypto.unprotectPatient(consultation.patient as Record<string, unknown>) as typeof consultation.patient;
    const diagnoses = (resolved.diagnoses as Array<{ name: string; icd10Code: string; confidence: number; reasoning: string }>) || [];
    const recommendations = (resolved.recommendations as string[]) || [];
    const redFlags = (resolved.redFlags as string[]) || [];
    const rawResponse = (resolved.rawResponse as Record<string, unknown> | null) ?? null;
    const cr = consultation.clinicalRecord;
    const age = calculateAge(p.birthDate);

    return buildAiAnalysisPdfBuffer({
      patientName: p.fullName,
      patientPhone: p.phone,
      birthDate: p.birthDate.toISOString().slice(0, 10),
      gender: p.gender,
      patientAge: age,
      facilityName: consultation.utFacility.name,
      facilityCode: consultation.utFacility.code,
      doctorName: consultation.mtDoctor?.fullName,
      triageLevel: resolved.triageLevel,
      summary: resolved.summary,
      diagnoses,
      recommendations,
      redFlags,
      rawResponse,
      complaints: cr?.complaints,
      anamnesisMorbi: cr?.anamnesisMorbi,
      medications: cr?.medications,
      labResults: cr?.labResults,
      weight: cr?.weight,
      height: cr?.height,
      bmi: cr?.bmi,
      vitalSigns: (cr?.vitalSigns as Record<string, number>) ?? {},
    }, locale);
  }

  async submitFeedback(aiAnalysisId: string, userId: string, rating: string, comment?: string) {
    return this.prisma.aiFeedback.create({
      data: { aiAnalysisId, userId, rating, comment },
    });
  }

  async confirmStep(consultationId: string, stepId: string, doctorId: string, notes?: string) {
    const consultation = await this.prisma.consultation.findUnique({ where: { id: consultationId } });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    if (consultation.status !== ConsultationStatus.IN_PROGRESS) {
      throw new BadRequestException('AI bosqichini faqat jarayondagi konsultatsiyada tasdiqlash mumkin');
    }
    if (consultation.mtDoctorId !== doctorId) {
      throw new ForbiddenException('Faqat mas\'ul shifokor AI bosqichini tasdiqlashi mumkin');
    }

    const step = await this.prisma.aiAnalysisStep.findFirst({
      where: { id: stepId, consultationId },
    });
    if (!step) throw new NotFoundException('AI bosqichi topilmadi');
    if (step.status !== 'DONE') throw new BadRequestException('Bosqich hali tugallanmagan');

    return this.prisma.aiAnalysisStep.update({
      where: { id: stepId },
      data: {
        doctorConfirmed: true,
        confirmedById: doctorId,
        confirmedAt: new Date(),
        doctorNotes: notes,
      },
      include: { confirmedBy: { select: { fullName: true } } },
    });
  }

  /** PHI ni AI ga yuborishdan oldin de-identifikatsiya */
  private deidentifyClinicalData(data: Record<string, unknown>) {
    const copy = { ...data };
    for (const key of ['fullName', 'phone', 'pinfl', 'passportNumber', 'address']) {
      delete copy[key];
    }
    return copy;
  }

  async chatWithAi(consultationId: string, question: string, localeRaw?: string) {
    const locale = normalizeAiLocale(localeRaw);
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { aiAnalysis: true, clinicalRecord: true, patient: true },
    });

    if (!consultation) return { answer: 'Konsultatsiya topilmadi', disclaimer: '' };

    const aiContext = consultation.aiAnalysis
      ? {
          summary: consultation.aiAnalysis.summary,
          diagnoses: consultation.aiAnalysis.diagnoses,
          triageLevel: consultation.aiAnalysis.triageLevel,
          recommendations: consultation.aiAnalysis.recommendations,
          redFlags: consultation.aiAnalysis.redFlags,
          clinicalConclusion: (consultation.aiAnalysis.rawResponse as Record<string, unknown> | null)?.clinicalConclusion,
        }
      : null;

    const answer = await this.callOpenAiChat(
      [
        {
          role: 'user',
          content: `AI KLINIK XULOSA KONTEKSTI:\n${JSON.stringify(aiContext, null, 2)}\n\nKlinik ma'lumotlar:\n${JSON.stringify(this.deidentifyClinicalData({
            complaints: consultation.clinicalRecord?.complaints,
            anamnesisMorbi: consultation.clinicalRecord?.anamnesisMorbi,
            vitalSigns: consultation.clinicalRecord?.vitalSigns,
            medications: consultation.clinicalRecord?.medications,
            gender: consultation.patient.gender,
            ageYears: calculateAge(consultation.patient.birthDate),
          }), null, 2)}\n\nShifokor savoli: ${question}`,
        },
      ],
      { maxTokens: 4096, systemPrompt: withLang(CHAT_SYSTEM_PROMPT, locale) },
    );

    if (!answer) {
      if (this.getOpenAiConfig()) {
        return {
          answer: 'AI xizmati vaqtincha mavjud emas. Iltimos, keyinroq urinib ko\'ring.',
          disclaimer: 'Bu faqat AI tavsiyasi, yakuniy qaror shifokorga tegishli.',
        };
      }
      return {
        answer: `AI yordamchi: "${question}" savolingiz bo'yicha — mavjud klinik ma'lumotlar va AI tahlil natijalariga asoslanib, qo'shimcha tekshiruvlar va kuzatuv tavsiya etiladi. Yakuniy qaror shifokorga tegishli.`,
        disclaimer: 'Bu faqat AI tavsiyasi, yakuniy qaror shifokorga tegishli.',
      };
    }

    return {
      answer,
      disclaimer: 'Bu faqat AI tavsiyasi, yakuniy qaror shifokorga tegishli.',
    };
  }

  private async updateStep(consultationId: string, step: string, status: 'IN_PROGRESS' | 'DONE') {
    await this.prisma.aiAnalysisStep.updateMany({
      where: { consultationId, step },
      data: {
        status,
        completedAt: status === 'DONE' ? new Date() : undefined,
      },
    });
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Hujjatlar AI tahlilini konsultatsiya AI xulosasiga qo'shish */
  async integrateAttachmentFindings(consultationId: string): Promise<void> {
    const attachments = await this.prisma.attachment.findMany({
      where: { consultationId, aiAnalysisStatus: 'DONE', aiSummary: { not: null } },
    });
    if (!attachments.length) return;

    const existing = await this.prisma.aiAnalysis.findUnique({ where: { consultationId } });
    const docSummaries = attachments.map((a) => {
      const findings = a.aiFindings as { documentType?: string; findings?: string[]; abnormalities?: string[] } | null;
      return {
        fileName: a.fileName,
        summary: a.aiSummary,
        documentType: findings?.documentType,
        findings: findings?.findings || [],
        abnormalities: findings?.abnormalities || [],
      };
    });

    const attachmentBlock = docSummaries
      .map(
        (d) =>
          `• ${d.fileName} (${d.documentType || 'hujjat'}): ${d.summary}` +
          (d.abnormalities?.length ? ` | Anomaliyalar: ${d.abnormalities.join('; ')}` : ''),
      )
      .join('\n');

    const extraRecs = docSummaries.flatMap((d) => {
      const f = d.findings as string[] | undefined;
      return f?.length ? [`${d.fileName}: ${f.join(', ')}`] : [];
    });

    if (existing) {
      const currentRecs = (existing.recommendations as string[]) || [];
      const mergedRecs = [...new Set([...currentRecs, ...extraRecs])].slice(0, 12);
      const raw = (existing.rawResponse as Record<string, unknown>) || {};
      await this.prisma.aiAnalysis.update({
        where: { consultationId },
        data: {
          summary: `${existing.summary}\n\n📎 Hujjatlar AI tahlili:\n${attachmentBlock}`,
          recommendations: mergedRecs,
          rawResponse: { ...raw, attachmentAnalyses: docSummaries },
        },
      });
    } else {
      await this.prisma.aiAnalysis.create({
        data: {
          consultationId,
          summary: `Hujjatlar asosida AI tahlil:\n${attachmentBlock}`,
          diagnoses: [],
          triageLevel: 'MEDIUM',
          recommendations: extraRecs.length ? extraRecs : ['Hujjatlarni shifokor ko\'rib chiqishi kerak'],
          redFlags: docSummaries.some((d) => (d.abnormalities?.length ?? 0) > 0)
            ? ['Hujjatlarda anomaliyalar aniqlangan — shifokor diqqati talab qilinadi']
            : [],
          rawResponse: { attachmentAnalyses: docSummaries },
        },
      });
    }
  }
}
