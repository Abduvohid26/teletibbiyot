import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TriageLevel, UserRole, Prisma, ConsultationStatus } from '@prisma/client';
import { MT_NOTIFY_ROLES } from '../common/roles.constants';
import { BRAND } from '@ishifo/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { VideoGateway } from '../video/video.gateway';

const SYSTEM_PROMPT = `Siz ${BRAND.name} platformasining AI-yordamchi shifokorisiz.
MUHIM: Siz HECH QACHON yakuniy, rasmiy tibbiy tashxis qo'ymaysiz.
Sizning vazifangiz faqat:
1. Ehtimoliy tashxislar ro'yxatini (differensial diagnostika) taklif qilish
2. Xavf darajasini baholash (LOW/MEDIUM/HIGH/EMERGENCY)
3. Qo'shimcha tekshiruvlar bo'yicha tavsiyalar berish
4. Qizil bayroqlar (red flags) aniqlash

Javobni faqat quyidagi JSON formatida bering:
{
  "summary": "qisqa klinik xulosa",
  "diagnoses": [{"name": "...", "icd10Code": "...", "confidence": 0-100, "reasoning": "..."}],
  "triageLevel": "LOW|MEDIUM|HIGH|EMERGENCY",
  "recommendations": ["..."],
  "redFlags": ["..."]
}`;

interface OpenAiAnalysisResult {
  summary: string;
  diagnoses: Array<{ name: string; icd10Code: string; confidence: number; reasoning: string }>;
  triageLevel: string;
  recommendations: string[];
  redFlags: string[];
  [key: string]: unknown;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notifications: NotificationsService,
    private videoGateway: VideoGateway,
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
      ageYears: Math.floor(
        (Date.now() - consultation.patient.birthDate.getTime()) / (365.25 * 86400000),
      ),
      gender: consultation.patient.gender,
    });

    let result = await this.callOpenAiAnalysis(clinicalData);
    if (!result) {
      if (this.config.get('NODE_ENV') === 'production') {
        await this.prisma.aiAnalysis.upsert({
          where: { consultationId },
          create: {
            consultationId,
            summary: 'AI tahlil xizmati vaqtincha mavjud emas. Shifokor mustaqil baholash o\'tkazishi kerak.',
            diagnoses: [],
            triageLevel: 'MEDIUM',
            recommendations: ['AI xizmati offline — qo\'lda klinik baholash talab qilinadi'],
            redFlags: [],
            rawResponse: { aiUnavailable: true },
          },
          update: {
            summary: 'AI tahlil xizmati vaqtincha mavjud emas.',
            rawResponse: { aiUnavailable: true },
          },
        });
        await this.prisma.consultation.update({
          where: { id: consultationId },
          data: { triageLevel: 'MEDIUM' },
        });
        this.videoGateway.emitConsultationEvent(consultationId, 'ai-analysis-updated', { consultationId });
        return { aiUnavailable: true };
      }
      result = { ...this.generateMockAnalysis(clinicalData), source: 'mock' };
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
    options?: { maxTokens?: number; json?: boolean },
  ): Promise<string | null> {
    const cfg = this.getOpenAiConfig();
    if (!cfg) return null;

    try {
      const body: Record<string, unknown> = {
        model: cfg.model,
        max_tokens: options?.maxTokens ?? 2048,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
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
      { json: true, maxTokens: 2048 },
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

  private generateMockAnalysis(clinicalData: Record<string, unknown>) {
    const complaints = String(clinicalData.complaints || '').toLowerCase();

    if (complaints.includes('qorin') || complaints.includes('oshqozon') || complaints.includes('gastrit')) {
      return {
        summary: 'Bemorda oshqozon-qorin sohasidagi shikoyatlar, ovqatdan keyin og\'riq va ko\'ngil aynishi kuzatilmoqda.',
        diagnoses: [
          { name: 'Gastrit', icd10Code: 'K29.7', confidence: 89, reasoning: 'Oshqozon shikoyatlari va anamnezga mos' },
          { name: 'Gastroezofageal reflyuks', icd10Code: 'K21.0', confidence: 45, reasoning: 'Ko\'ngil aynishi va ovqatdan keyin og\'riq' },
        ],
        triageLevel: 'MEDIUM',
        recommendations: [
          'Umumiy qon tahlili',
          'Qorin bo\'shlig\'i UZI',
          'Gastroskopiya',
          'Helicobacter pylori testi',
        ],
        redFlags: [],
      };
    }

    if (complaints.includes('yurak') || complaints.includes('ko\'krak')) {
      return {
        summary: 'Bemorda ko\'krak qafasi og\'rig\'i shikoyati mavjud.',
        diagnoses: [
          { name: 'Stabil angina pektoris', icd10Code: 'I20.8', confidence: 72, reasoning: 'Ko\'krak og\'rig\'i shikoyati' },
        ],
        triageLevel: 'HIGH',
        recommendations: ['EKG', 'Troponin testi', 'Ekokardiografiya'],
        redFlags: ['Ko\'krak og\'rig\'i — yurak kasalligi belgisi bo\'lishi mumkin'],
      };
    }

    return {
      summary: 'Klinik ma\'lumotlar asosida dastlabki tahlil amalga oshirildi.',
      diagnoses: [
        { name: 'Umumiy tibbiy ko\'rik talab etiladi', icd10Code: 'Z00.0', confidence: 60, reasoning: 'Aniq tashxis uchun qo\'shimcha ma\'lumot kerak' },
      ],
      triageLevel: 'LOW',
      recommendations: ['Umumiy qon tahlili', 'Bemorni klinik ko\'rik'],
      redFlags: [],
    };
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

    if (!consultation) return { answer: 'Konsultatsiya topilmadi' };

    const answer = await this.callOpenAiChat(
      [
        {
          role: 'user',
          content: `Konsultatsiya ma'lumotlari (de-identified):\n${JSON.stringify({
            aiAnalysis: consultation.aiAnalysis,
            clinical: this.deidentifyClinicalData({
              complaints: consultation.clinicalRecord?.complaints,
              vitalSigns: consultation.clinicalRecord?.vitalSigns,
              gender: consultation.patient.gender,
            }),
          })}\n\nShifokor savoli: ${question}`,
        },
      ],
      { maxTokens: 1024 },
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
