import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const VISION_PROMPT = `Siz tibbiy hujjatlar va tasvirlarni tahlil qiluvchi AI yordamchisiz.
MUHIM: Siz HECH QACHON yakuniy rasmiy tashxis qo'ymaysiz.
Faqat kuzatilgan topilmalar, ehtimoliy yo'nalishlar va qizil bayroqlarni JSON formatida bering:
{
  "summary": "qisqa tavsif",
  "documentType": "rentgen|MRT|UZI|lab|boshqa",
  "findings": ["..."],
  "abnormalities": ["..."],
  "recommendations": ["..."],
  "confidence": 0-100
}`;

export interface AttachmentAiResult {
  summary: string;
  documentType: string;
  findings: string[];
  abnormalities: string[];
  recommendations: string[];
  confidence: number;
  source?: 'mock' | 'openai';
}

@Injectable()
export class AttachmentAnalysisService {
  private readonly logger = new Logger(AttachmentAnalysisService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: ConfigService,
  ) {}

  async analyzeAttachment(attachmentId: string): Promise<void> {
    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || attachment.aiAnalysisStatus === 'DONE') return;

    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: { aiAnalysisStatus: 'PROCESSING' },
    });

    try {
      const result = await this.runAnalysis(attachment.fileUrl, attachment.fileType, attachment.fileName);
      await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          aiAnalysisStatus: 'DONE',
          aiSummary: result.summary,
          aiFindings: result as unknown as Prisma.InputJsonValue,
          analyzedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`Attachment AI xatoligi ${attachmentId}: ${err}`);
      await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: { aiAnalysisStatus: 'FAILED' },
      });
    }
  }

  async analyzeConsultationAttachments(consultationId: string): Promise<void> {
    const pending = await this.prisma.attachment.findMany({
      where: {
        consultationId,
        aiAnalysisStatus: { in: ['PENDING', 'FAILED'] },
      },
    });
    for (const a of pending) {
      await this.analyzeAttachment(a.id);
    }
  }

  private isProduction() {
    return this.config.get('NODE_ENV') === 'production';
  }

  private async runAnalysis(
    fileKey: string,
    fileType: string,
    fileName: string,
  ): Promise<AttachmentAiResult> {
    if (!this.storage.isAvailable()) {
      if (this.isProduction()) {
        throw new Error('S3 storage mavjud emas — attachment AI productionda ishlamaydi');
      }
      return this.mockAnalysis(fileName, fileType);
    }

    const { buffer, contentType } = await this.storage.getObjectBuffer(fileKey);
    const mime = fileType || contentType;
    const isImage = mime.startsWith('image/');

    if (isImage) {
      const vision = await this.callVision(buffer, mime, fileName);
      if (vision) return vision;
    }

    if (mime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      const pdf = await this.callPdfAnalysis(fileName);
      if (pdf) return pdf;
    }

    if (this.isProduction()) {
      throw new Error('OpenAI attachment tahlili muvaffaqiyatsiz — productionda mock taqiqlangan');
    }
    return this.mockAnalysis(fileName, mime);
  }

  private getOpenAiConfig() {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'your-openai-api-key-here') return null;
    return { apiKey, model: this.config.get('OPENAI_MODEL') || 'gpt-4o-mini' };
  }

  private async callVision(
    buffer: Buffer,
    mime: string,
    fileName: string,
  ): Promise<AttachmentAiResult | null> {
    const cfg = this.getOpenAiConfig();
    if (!cfg) return null;

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model.includes('gpt-4') ? cfg.model : 'gpt-4o-mini',
          max_tokens: 1200,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: VISION_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Tibbiy hujjat/tasvir tahlili (${fileName}). JSON javob bering.`,
                },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) return null;
      return this.parseResult(text, fileName);
    } catch (err) {
      this.logger.warn(`Vision API: ${err}`);
      return null;
    }
  }

  private async callPdfAnalysis(fileName: string): Promise<AttachmentAiResult | null> {
    const cfg = this.getOpenAiConfig();
    if (!cfg) return null;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 800,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: VISION_PROMPT },
            {
              role: 'user',
              content: `PDF tibbiy hujjat yuklandi: "${fileName}". Fayl nomi va tibbiy kontekstga asoslanib, ehtimoliy hujjat turi va tekshiruv yo'nalishlarini JSON da bering. Aniq tashxis qo'ymang.`,
            },
          ],
        }),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) return null;
      return this.parseResult(text, fileName);
    } catch {
      return null;
    }
  }

  private parseResult(text: string, fileName: string): AttachmentAiResult {
    try {
      const parsed = JSON.parse(text) as Partial<AttachmentAiResult>;
      return {
        summary: parsed.summary || `${fileName} tahlil qilindi`,
        documentType: parsed.documentType || this.guessDocType(fileName),
        findings: parsed.findings || [],
        abnormalities: parsed.abnormalities || [],
        recommendations: parsed.recommendations || [],
        confidence: parsed.confidence ?? 70,
      };
    } catch {
      if (this.isProduction()) {
        throw new Error('AI javobini parse qilib bo\'lmadi');
      }
      return this.mockAnalysis(fileName, 'application/octet-stream');
    }
  }

  private mockAnalysis(fileName: string, mime: string): AttachmentAiResult {
    const lower = fileName.toLowerCase();
    const docType = this.guessDocType(fileName);
    const mock = (data: Omit<AttachmentAiResult, 'source'>): AttachmentAiResult => ({ ...data, source: 'mock' });

    if (lower.includes('rentgen') || lower.includes('xray') || lower.includes('x-ray')) {
      return mock({
        summary: 'Rentgen tasviri yuklandi. AI dastlabki tahlil: o\'pkada infiltrativ o\'zgarishlar ehtimoli ko\'rib chiqilmoqda.',
        documentType: 'rentgen',
        findings: ['O\'pkada noaniq soyalar', 'Mediastinum markazda'],
        abnormalities: ['Past o\'ng lobda noaniq soya — pnevmoniya yoki atelektaz ehtimoli'],
        recommendations: ['Shifokor bilan tasvirni taqqoslash', 'KT tekshiruvi talab qilinishi mumkin'],
        confidence: 72,
      });
    }

    if (lower.includes('mrt') || lower.includes('mri')) {
      return mock({
        summary: 'MRT tasviri yuklandi. Strukturaviy o\'zgarishlar AI tomonidan dastlabki baholandi.',
        documentType: 'MRT',
        findings: ['Miya/o\'rgan strukturalari ko\'rib chiqildi'],
        abnormalities: ['Aniq patologiya tasdiqlanmagan — shifokor ko\'rigini talab qiladi'],
        recommendations: ['Radiolog xulosasi bilan solishtirish'],
        confidence: 65,
      });
    }

    if (lower.includes('uzi') || lower.includes('ultrasound')) {
      return mock({
        summary: 'UZI natijasi yuklandi. Ehoko strukturalar tahlil qilindi.',
        documentType: 'UZI',
        findings: ['Organ konturlari saqlangan'],
        abnormalities: [],
        recommendations: ['Dinamik kuzatuv tavsiya etiladi'],
        confidence: 68,
      });
    }

    if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
      return mock({
        summary: `PDF laboratoriya yoki tekshiruv hujjati (${fileName}) AI tomonidan qayta ishlandi.`,
        documentType: 'lab',
        findings: ['Hujjat turi: laboratoriya/tekshiruv natijasi'],
        abnormalities: ['Normadan chetga chiqishlar shifokor tomonidan tasdiqlanishi kerak'],
        recommendations: ['Natijalarni klinik belgilar bilan solishtirish'],
        confidence: 60,
      });
    }

    return mock({
      summary: `Tibbiy hujjat (${fileName}) yuklandi va AI dastlabki ko\'rib chiqdi.`,
      documentType: docType,
      findings: ['Hujjat muvaffaqiyatli qabul qilindi'],
      abnormalities: [],
      recommendations: ['Markaziy shifokor tomonidan ko\'rib chiqish'],
      confidence: 55,
    });
  }

  private guessDocType(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.includes('rentgen') || lower.includes('xray')) return 'rentgen';
    if (lower.includes('mrt') || lower.includes('mri')) return 'MRT';
    if (lower.includes('uzi')) return 'UZI';
    if (lower.endsWith('.pdf')) return 'lab';
    return 'boshqa';
  }
}
