import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { VideoGateway } from '../video/video.gateway';
import { AiFailureReason, classifyOpenAiStatus } from './ai-availability';

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
  source?: 'openai' | 'unavailable';
}

type AttachmentOutcome =
  | { kind: 'done'; result: AttachmentAiResult }
  | { kind: 'failed' | 'skipped'; reason: AiFailureReason | 'unsupported_type' | 'storage' };

@Injectable()
export class AttachmentAnalysisService {
  private readonly logger = new Logger(AttachmentAnalysisService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: ConfigService,
    private videoGateway: VideoGateway,
  ) {}

  /**
   * Bitta faylni AI tahlil qilish. Natija:
   * - DONE    — AI haqiqatan tahlil qildi (aiSummary to'ldiriladi)
   * - FAILED  — AI ishlamadi (kalit yo'q, limit, tarmoq) — keyinroq qayta urinish mumkin
   * - SKIPPED — fayl turini AI o'qiy olmaydi (masalan DICOM) — shifokor o'zi ko'radi
   * AI ishlamasa soxta "tahlil" yozilmaydi, aks holda u shifokorga haqiqiy xulosa bo'lib ko'rinadi.
   */
  async analyzeAttachment(attachmentId: string): Promise<void> {
    // Atomik "egallash": bir fayl parallel ikki marta tahlil qilinmasin
    // (yuklashdagi navbat va finalize bir vaqtda chaqirishi mumkin)
    const claimed = await this.prisma.attachment.updateMany({
      where: { id: attachmentId, aiAnalysisStatus: { in: ['PENDING', 'FAILED'] } },
      data: { aiAnalysisStatus: 'PROCESSING' },
    });
    if (!claimed.count) return;
    await this.emitAnalyzed(attachmentId).catch(() => undefined);

    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) return;

    try {
      const outcome = await this.runAnalysis(attachment.fileUrl, attachment.fileType, attachment.fileName);
      if (outcome.kind === 'done') {
        await this.prisma.attachment.update({
          where: { id: attachmentId },
          data: {
            aiAnalysisStatus: 'DONE',
            aiSummary: outcome.result.summary,
            aiFindings: { ...outcome.result, source: 'openai' } as unknown as Prisma.InputJsonValue,
            analyzedAt: new Date(),
          },
        });
      } else {
        await this.prisma.attachment.update({
          where: { id: attachmentId },
          data: {
            aiAnalysisStatus: outcome.kind === 'skipped' ? 'SKIPPED' : 'FAILED',
            aiSummary: null,
            aiFindings: { source: 'unavailable', reason: outcome.reason } as Prisma.InputJsonValue,
            analyzedAt: new Date(),
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Attachment AI xatoligi ${attachmentId}: ${err}`);
      await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          aiAnalysisStatus: 'FAILED',
          aiSummary: null,
          aiFindings: { source: 'unavailable', reason: 'error' } as Prisma.InputJsonValue,
        },
      });
    }
    await this.emitAnalyzed(attachmentId).catch(() => undefined);
  }

  /** Fayl holati o'zgardi — ochiq turgan shifokor/UT ekranlari darhol yangilansin */
  private async emitAnalyzed(attachmentId: string) {
    const a = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!a?.consultationId) return;
    this.videoGateway.emitConsultationEvent(a.consultationId, 'attachment-analyzed', {
      id: a.id,
      fileName: a.fileName,
      fileType: a.fileType,
      fileSize: a.fileSize,
      uploadedAt: a.uploadedAt,
      aiAnalysisStatus: a.aiAnalysisStatus,
      aiSummary: a.aiSummary,
      aiFindings: a.aiFindings,
      analyzedAt: a.analyzedAt,
    });
  }

  async analyzeConsultationAttachments(consultationId: string): Promise<void> {
    const pending = await this.prisma.attachment.findMany({
      where: {
        consultationId,
        aiAnalysisStatus: { in: ['PENDING', 'FAILED'] },
      },
      select: { id: true },
    });
    for (const a of pending) {
      await this.analyzeAttachment(a.id);
    }
  }

  private async runAnalysis(
    fileKey: string,
    fileType: string,
    fileName: string,
  ): Promise<AttachmentOutcome> {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.dcm') || lower.endsWith('.dicom') || fileType === 'application/dicom') {
      return { kind: 'skipped', reason: 'unsupported_type' };
    }
    if (!this.getOpenAiConfig()) return { kind: 'failed', reason: 'not_configured' };
    if (!this.storage.isAvailable()) return { kind: 'failed', reason: 'storage' };

    const { buffer, contentType } = await this.storage.getObjectBuffer(fileKey);
    const mime = fileType || contentType;

    if (mime.startsWith('image/')) {
      // HEIC/TIFF ni OpenAI o'qimaydi
      if (!/^image\/(jpe?g|png|webp|gif)$/i.test(mime)) {
        return { kind: 'skipped', reason: 'unsupported_type' };
      }
      return this.callModel(fileName, [
        { type: 'text', text: `Tibbiy hujjat/tasvir tahlili (${fileName}). JSON javob bering.` },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${buffer.toString('base64')}`, detail: 'high' } },
      ]);
    }

    if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
      // PDF ning O'ZI yuboriladi — model matn va sahifa tasvirlarini o'qiydi
      return this.callModel(fileName, [
        { type: 'text', text: `Tibbiy PDF hujjat tahlili (${fileName}). Hujjat mazmunini o'qing va JSON javob bering.` },
        {
          type: 'file',
          file: { filename: fileName, file_data: `data:application/pdf;base64,${buffer.toString('base64')}` },
        },
      ]);
    }

    return { kind: 'skipped', reason: 'unsupported_type' };
  }

  private getOpenAiConfig() {
    const apiKey = this.config.get('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'your-openai-api-key-here') return null;
    return { apiKey, model: this.config.get('OPENAI_MODEL') || 'gpt-4o-mini' };
  }

  private async callModel(fileName: string, content: unknown[]): Promise<AttachmentOutcome> {
    const cfg = this.getOpenAiConfig();
    if (!cfg) return { kind: 'failed', reason: 'not_configured' };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({
          // Rasm/PDF o'qish uchun vision modeli kerak
          model: cfg.model.includes('gpt-4') ? cfg.model : 'gpt-4o-mini',
          max_tokens: 1200,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: VISION_PROMPT },
            { role: 'user', content },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.warn(`Hujjat AI (${fileName}) ${response.status}: ${errText.slice(0, 300)}`);
        return { kind: 'failed', reason: classifyOpenAiStatus(response.status) };
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      const result = text ? this.parseResult(text, fileName) : null;
      return result ? { kind: 'done', result } : { kind: 'failed', reason: 'invalid_response' };
    } catch (err) {
      this.logger.warn(`Hujjat AI (${fileName}) ulanish xatosi: ${err}`);
      return { kind: 'failed', reason: 'network' };
    }
  }

  private parseResult(text: string, fileName: string): AttachmentAiResult | null {
    try {
      const parsed = JSON.parse(text) as Partial<AttachmentAiResult>;
      if (!parsed.summary) return null;
      return {
        summary: parsed.summary || `${fileName} tahlil qilindi`,
        documentType: parsed.documentType || this.guessDocType(fileName),
        findings: parsed.findings || [],
        abnormalities: parsed.abnormalities || [],
        recommendations: parsed.recommendations || [],
        confidence: parsed.confidence ?? 70,
      };
    } catch {
      return null;
    }
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
