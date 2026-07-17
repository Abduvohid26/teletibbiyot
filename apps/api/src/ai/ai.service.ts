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

const SYSTEM_PROMPT = `Siz ${BRAND.name} platformasining AI-yordamchi shifokorisiz.
MUHIM: Siz HECH QACHON yakuniy, rasmiy tibbiy tashxis qo'ymaysiz — bu faqat AI konsensus xulosasi.
O'zbekiston SSV klinik protokollari va dalillarga asoslangan tavsiyalar bering.
Barcha matnlar o'zbek tilida bo'lsin.

Javobni faqat quyidagi JSON formatida bering:
{
  "summary": "qisqa asosiy klinik xulosa (2-4 jumla)",
  "diagnoses": [{"name": "...", "icd10Code": "...", "confidence": 0-100, "reasoning": "..."}],
  "triageLevel": "LOW|MEDIUM|HIGH|EMERGENCY",
  "recommendations": ["..."],
  "redFlags": ["..."],
  "clinicalConclusion": {
    "mainConclusion": "konsensus xulosa — kritik topilmalar",
    "consensusDiagnoses": [{
      "name": "asosiy tashxis",
      "icd10Code": "F50.00",
      "confidence": 94,
      "protocolReference": "O'zbekiston SSV ... bo'yicha protokoli",
      "justification": "batafsil asoslash matni",
      "logicChain": ["1-qadam mantiq", "2-qadam mantiq"]
    }],
    "alternativeDiagnoses": [{"name": "...", "icd10Code": "...", "confidence": 6, "justification": "..."}],
    "scientificArticles": [{"title": "...", "url": "https://...", "description": "..."}],
    "treatmentSteps": ["qadam: ..."],
    "medicationWarnings": ["DDI ogohlantirish..."],
    "medications": [{"name": "...", "dose": "...", "tradeNames": "O'zbekistonda mavjud", "instructions": "...", "diagnosis": "..."}],
    "additionalTests": ["Qon shakarini tekshirish - ..."],
    "patientRouting": {"level": "Ambulator", "description": "..."},
    "recommendedSpecialists": ["Psixolog — ..."],
    "followUp": "1 oy ichida qayta ko'rik",
    "riskFactors": ["..."],
    "riskSeverity": {"label": "O'rtacha", "score": 5, "max": 10},
    "prognosisShort": "1-3 oy prognoz",
    "prognosisLong": "1-5 yil prognoz",
    "prognosisFactors": ["..."],
    "dietGeneral": ["Kunlik ratsion..."],
    "dietByDiagnosis": {"diagnosis": "...", "allowed": ["..."], "restricted": ["..."], "notes": "..."},
    "preventionTips": ["Profilaktika..."],
    "herbalMedicine": [{"name": "...", "part": "...", "preparation": "...", "context": "...", "caution": "..."}],
    "qualityScore": {"overall": 70, "notes": "..."},
    "rejectedHypotheses": [{"name": "...", "reason": "..."}],
    "recordedFindings": ["Kartada qayd etilgan..."]
  }
}

MUHIM — SOXTA MA'LUMOT TAQIQLANADI:
Faqat bemorning haqiqiy shikoyatlari, anamnezi va biriktirilgan hujjatlari (tahlil natijalari,
rasmlar, hujjatlar) asosida xulosa chiqaring. Klinik asos bo'lmagan bo'limni TO'LDIRISH SHART EMAS —
bunday holda o'sha maydonni bo'sh massiv ([]) yoki umuman qoldirib keting. Har bir bandning soni
oldindan belgilanmagan — nechta tashxis, tavsiya yoki dalil bo'lsa, faqat o'shancha yozing:
- consensusDiagnoses: faqat haqiqatan dalillar tasdiqlagan tashxis(lar); har biri uchun
  confidence, justification va logicChain aniq shikoyat/anamnez/hujjatga bog'langan bo'lsin
- alternativeDiagnoses: faqat differensial diagnostikada real ko'rib chiqilgan bo'lsa
- scientificArticles: faqat aniq shu tashxis/holat uchun haqiqatan mavjud manba (lex.uz, ssv.uz,
  PubMed, Cochrane, Lancet/NEJM) bo'lsa qo'shing — mavhum yoki noaniq URL o'ylab topmang
- treatmentSteps, medications, medicationWarnings, additionalTests, recommendedSpecialists:
  faqat aniq shu bemorning holatiga tegishli bo'lsa
- dietGeneral, preventionTips, herbalMedicine: faqat aniq shu tashxisga bevosita aloqador va
  klinik jihatdan asoslangan bo'lsa qo'shing — umumiy/shablon maslahat yozmang
- riskFactors, riskSeverity, prognosisShort/Long/Factors, qualityScore, recordedFindings,
  rejectedHypotheses: faqat mavjud ma'lumotlar asosida xulosa chiqarish mumkin bo'lsa
diagnoses massivida eng yuqori ishonchli tashxis birinchi.`;

const CHAT_SYSTEM_PROMPT = `Siz ${BRAND.name} telemedicine platformasining AI klinik yordamchisisiz.
Shifokor sizga bemorning AI klinik xulosasi haqida qo'shimcha savollar beradi.
Javob bering: aniq, batafsil, o'zbek tilida, professional tibbiy uslubda.
MUHIM: Yakuniy rasmiy tashxis qo'ymang — faqat AI maslahati va tavsiya.
Klinik xulosa kontekstidan foydalaning. Agar ma'lumot yetarli bo'lmasa, qaysi qo'shimcha tekshiruv kerakligini ayting.
Markdown ishlatmang — oddiy matn.`;

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

  async analyzeConsultation(consultationId: string): Promise<unknown> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { clinicalRecord: true, patient: true },
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
    });

    let result = await this.callOpenAiAnalysis(clinicalData);
    if (!result) {
      await this.saveUnavailableAnalysis(consultationId);
      return { aiUnavailable: true };
    }

    const triageLevel = result.triageLevel as TriageLevel;

    await this.prisma.aiAnalysis.upsert({
      where: { consultationId },
      create: {
        consultationId,
        summary: result.summary,
        diagnoses: result.diagnoses,
        triageLevel,
        recommendations: result.recommendations,
        redFlags: result.redFlags,
        rawResponse: result as Prisma.InputJsonValue,
      },
      update: {
        summary: result.summary,
        diagnoses: result.diagnoses,
        triageLevel,
        recommendations: result.recommendations,
        redFlags: result.redFlags,
        rawResponse: result as Prisma.InputJsonValue,
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
  ): Promise<OpenAiAnalysisResult | null> {
    const text = await this.callOpenAiChat(
      [
        {
          role: 'user',
          content: `Quyidagi klinik ma'lumotlarni tahlil qiling. Javobni faqat JSON obyekt sifatida qaytaring:\n${JSON.stringify(clinicalData, null, 2)}`,
        },
      ],
      { json: true, maxTokens: 8192 },
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
  async buildAnalysisPdf(consultationId: string, user: AuthUser): Promise<{ buffer: Buffer; fileName: string }> {
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

    const buffer = await this.buildAnalysisPdfBufferForConsultation(consultation);
    const fileName = `tashxis-${consultationId.slice(0, 8)}.pdf`;
    return { buffer, fileName };
  }

  /** Yakunlashda UT operator uchun tashxis PDF saqlash */
  async persistAnalysisReport(consultationId: string, generatedById?: string): Promise<void> {
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

    const buffer = await this.buildAnalysisPdfBufferForConsultation(consultation);
    const fileName = `tashxis-${consultationId.slice(0, 8)}.pdf`;
    const fileKey = `reports/${consultationId}/${fileName}`;
    await this.storage.uploadBuffer(fileKey, buffer, 'application/pdf');

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
  ): Promise<Buffer> {
    const analysis = consultation.aiAnalysis;
    if (!analysis) throw new NotFoundException('AI tahlil topilmadi');
    const p = this.crypto.unprotectPatient(consultation.patient as Record<string, unknown>) as typeof consultation.patient;
    const diagnoses = (analysis.diagnoses as Array<{ name: string; icd10Code: string; confidence: number; reasoning: string }>) || [];
    const recommendations = (analysis.recommendations as string[]) || [];
    const redFlags = (analysis.redFlags as string[]) || [];
    const rawResponse = (analysis.rawResponse as Record<string, unknown> | null) ?? null;
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
      triageLevel: analysis.triageLevel,
      summary: analysis.summary,
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
    });
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

  async chatWithAi(consultationId: string, question: string) {
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
      { maxTokens: 2048, systemPrompt: CHAT_SYSTEM_PROMPT },
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
