import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { VideoGateway } from '../video/video.gateway';
import { AiFailureReason, classifyOpenAiStatus } from './ai-availability';

const VISION_PROMPT = `Siz tibbiy hujjatlar va tasvirlarni tahlil qiluvchi AI yordamchisiz.
MUHIM: Siz HECH QACHON yakuniy rasmiy tashxis qo'ymaysiz.

ENG ASOSIY QOIDA — FAQAT HUJJATDA BOR NARSA:
- Avval hujjatdagi matnni "transcript" ga AYNAN ko'chiring (raqamlar, birliklar, normalar qanday
  yozilgan bo'lsa shunday). Tasvirda matn bo'lmasa — bo'sh qoldiring.
- findings va abnormalities FAQAT hujjatda haqiqatan yozilgan qiymat yoki tasvirda haqiqatan
  ko'rinib turgan belgi asosida. Har bir band uchun "quote" — transcript dan AYNAN olingan parcha.
  abnormalities matnida qiymat va normani ham yozing: "Gemoglobin 96 g/l — past (norma 120–160)".
- Sarlavha, forma nomi yoki hujjat turi ("Qon tahlili", "Umumiy siydik tahlili") — bu NATIJA EMAS.
  Natija qiymatlari yozilmagan bo'lsa, hech qanday ko'rsatkich past/yuqori deb YOZMANG.
- Hujjatda yo'q ko'rsatkich, qiymat yoki norma o'ylab topish — QO'POL XATO. Shubha bo'lsa — yozmang.
- Hujjatda natija yo'q (bo'sh forma, faqat sarlavha, o'qib bo'lmaydi) bo'lsa: "hasResults": false,
  findings/abnormalities/recommendations bo'sh massiv, summary da buni ochiq ayting.
- recommendations — faqat topilgan natijalardan kelib chiqadigan amaliy qadamlar.

Javob faqat JSON:
{
  "transcript": "hujjatdagi matn aynan (3000 belgigacha)",
  "hasResults": true,
  "summary": "qisqa tavsif — faqat hujjatda bor narsa",
  "documentType": "rentgen|MRT|KT|UZI|EKG|lab|boshqa",
  "findings": [{"text": "topilma", "quote": "transcript dan aynan parcha"}],
  "abnormalities": [{"text": "me'yordan og'ish", "quote": "transcript dan aynan parcha"}],
  "recommendations": ["..."],
  "confidence": 0-100
}
Rentgen/MRT/KT/UZI tasvirida ko'rinadigan belgi uchun quote bo'lmasa, "quote": "" qoldiring.`;

/** Model ham fayl nomidan "taxmin" qilmasin — hujjat neytral nom bilan yuboriladi */
const NEUTRAL_PDF_NAME = 'hujjat.pdf';

/** Tasvirdan ko'rinadigan topilmalar — ularda matn iqtibosi bo'lmasligi mumkin */
const IMAGING_TYPES = new Set(['rentgen', 'mrt', 'kt', 'uzi', 'ekg']);

const NO_RESULTS_SUMMARY =
  "Hujjatda tahlil natijalari topilmadi (faqat sarlavha yoki bo'sh forma). Natijalar yozilgan hujjatni yuklang.";

export interface AttachmentAiResult {
  summary: string;
  documentType: string;
  findings: string[];
  abnormalities: string[];
  recommendations: string[];
  confidence: number;
  /** false — hujjatda natija yo'q; umumiy xulosa uni dalil sifatida ishlatmaydi */
  hasResults: boolean;
  /** Har bir topilma qaysi matnga tayanadi (tekshiruv uchun) */
  evidence?: Array<{ text: string; quote: string }>;
  /** Hujjatda tasdig'i topilmagani uchun olib tashlangan bandlar soni */
  droppedUnsupported?: number;
  source?: 'openai' | 'unavailable';
}

type RawItem = string | { text?: unknown; quote?: unknown };

/** Iqtibosda natija bor-yo'qligi: raqam yoki sifat natijasi (musbat/manfiy, +/-) */
const RESULT_MARKER =
  /\d|musbat|manfiy|aniqlandi|aniqlanmadi|topildi|topilmadi|положит|отриц|обнаруж|не обнаруж|positive|negative|detected|[+−-]{1,3}\s*$/i;

const normalize = (v: string) =>
  v
    .toLowerCase()
    .replace(/[«»"'`‘’“”]/g, '')
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ')
    .trim();

const numbersIn = (v: string) => v.match(/\d+(?:[.,]\d+)?/g)?.map((n) => n.replace(',', '.')) ?? [];

/**
 * Model javobini hujjat matniga solishtiradi: iqtibosi transcript da yo'q yoki
 * transcript da uchramaydigan raqam keltirgan topilma olib tashlanadi.
 * Natija yo'q hujjat uchun topilmalar va tavsiyalar bo'shatiladi.
 */
export function groundAttachmentResult(
  parsed: Record<string, unknown>,
  fileName: string,
): AttachmentAiResult | null {
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) return null;

  const transcript = typeof parsed.transcript === 'string' ? parsed.transcript : '';
  const normTranscript = normalize(transcript);
  const transcriptNumbers = new Set(numbersIn(transcript));
  const documentType =
    typeof parsed.documentType === 'string' && parsed.documentType ? parsed.documentType : guessDocType(fileName);
  const isImaging = IMAGING_TYPES.has(documentType.toLowerCase());

  const evidence: Array<{ text: string; quote: string }> = [];
  let dropped = 0;

  const keepSupported = (items: unknown): string[] => {
    if (!Array.isArray(items)) return [];
    const out: string[] = [];
    for (const raw of items as RawItem[]) {
      const text = (typeof raw === 'string' ? raw : typeof raw?.text === 'string' ? raw.text : '').trim();
      const quote = typeof raw === 'object' && raw && typeof raw.quote === 'string' ? raw.quote.trim() : '';
      if (!text) continue;

      // Lab/matnli hujjatda iqtibos natija bo'lishi shart: qiymat yoki sifat natijasi,
      // aks holda "Qon tahlili" sarlavhasining o'zi "dalil" bo'lib qoladi
      const quoteOk = quote
        ? normTranscript.includes(normalize(quote)) && (isImaging || RESULT_MARKER.test(quote))
        : isImaging;
      const numbersOk = numbersIn(text).every((n) => transcriptNumbers.has(n));
      if (quoteOk && numbersOk) {
        out.push(text);
        if (quote) evidence.push({ text, quote });
      } else {
        dropped++;
      }
    }
    return out;
  };

  let findings = keepSupported(parsed.findings);
  let abnormalities = keepSupported(parsed.abnormalities);

  // Natija yo'q: model o'zi shunday desa, yoki matnli hujjatda tasdiqlangan birorta topilma qolmasa
  const hasResults = parsed.hasResults !== false && (isImaging || findings.length + abnormalities.length > 0);

  if (!hasResults) {
    return {
      summary: NO_RESULTS_SUMMARY,
      documentType,
      findings: [],
      abnormalities: [],
      recommendations: [],
      confidence: 0,
      hasResults: false,
      droppedUnsupported: dropped,
    };
  }

  const recommendations = Array.isArray(parsed.recommendations)
    ? (parsed.recommendations as unknown[]).filter((r): r is string => typeof r === 'string' && !!r.trim())
    : [];
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 70;

  findings = findings.slice(0, 20);
  abnormalities = abnormalities.slice(0, 20);
  return {
    summary: parsed.summary.trim(),
    documentType,
    findings,
    abnormalities,
    // Tasdiqlanmagan topilma olib tashlangan bo'lsa, tavsiyalar ham unga tayangan bo'lishi mumkin
    recommendations: dropped && !abnormalities.length ? [] : recommendations,
    confidence: dropped ? Math.min(confidence, 50) : confidence,
    hasResults: true,
    evidence,
    droppedUnsupported: dropped,
  };
}

function guessDocType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('rentgen') || lower.includes('xray')) return 'rentgen';
  if (lower.includes('mrt') || lower.includes('mri')) return 'MRT';
  if (lower.includes('uzi')) return 'UZI';
  if (lower.endsWith('.pdf')) return 'lab';
  return 'boshqa';
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
        { type: 'text', text: 'Tibbiy hujjat/tasvir tahlili. Faqat tasvirda bor narsani yozing. JSON javob bering.' },
        { type: 'image_url', image_url: { url: `data:${mime};base64,${buffer.toString('base64')}`, detail: 'high' } },
      ]);
    }

    if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
      // PDF ning O'ZI yuboriladi — model matn va sahifa tasvirlarini o'qiydi
      return this.callModel(fileName, [
        {
          type: 'text',
          text: "Tibbiy PDF hujjat tahlili. Avval matnni aynan ko'chiring, keyin faqat unda bor qiymatlarga tayaning. JSON javob bering.",
        },
        {
          type: 'file',
          file: { filename: NEUTRAL_PDF_NAME, file_data: `data:application/pdf;base64,${buffer.toString('base64')}` },
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
          max_tokens: 2500,
          temperature: 0,
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
      const result = groundAttachmentResult(JSON.parse(text) as Record<string, unknown>, fileName);
      if (result?.droppedUnsupported) {
        this.logger.warn(`Hujjat AI (${fileName}): hujjatda tasdig'i yo'q ${result.droppedUnsupported} ta topilma olib tashlandi`);
      }
      return result;
    } catch {
      return null;
    }
  }
}
