import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  AishifokorHandoffPayload,
  AishifokorReferralPushBody,
} from './aishifokor.types';

@Injectable()
export class AishifokorService {
  private readonly logger = new Logger(AishifokorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiBase() && this.apiKey());
  }

  private apiBase(): string {
    return (this.config.get<string>('AISHIFOKOR_API_URL') || '').trim().replace(/\/$/, '');
  }

  private apiKey(): string {
    return (this.config.get<string>('AISHIFOKOR_API_KEY') || '').trim();
  }

  private webAppUrl(): string {
    return (this.config.get<string>('WEB_APP_URL') || 'http://localhost:3000').replace(/\/$/, '');
  }

  async fetchHandoff(token: string): Promise<AishifokorHandoffPayload> {
    const base = this.apiBase();
    const key = this.apiKey();
    if (!base || !key) {
      throw new BadRequestException('AiShifokor integratsiyasi sozlanmagan');
    }

    const url = `${base}/integrations/ishifo/handoff/${encodeURIComponent(token)}/`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `AiShifokor handoff xatosi (${res.status}): ${text.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as { success?: boolean; data?: AishifokorHandoffPayload };
    if (!json?.data) {
      throw new BadRequestException('AiShifokor handoff javobi noto\'g\'ri');
    }
    return json.data;
  }

  async acceptPush(body: AishifokorReferralPushBody) {
    const payload = body.payload;
    if (!body.handoff_token || !body.correlation_id) {
      throw new BadRequestException('handoff_token va correlation_id kerak');
    }

    const webUrl = this.webAppUrl();
    const openUrl =
      body.handoff_url ||
      `${webUrl}/ut?handoff=${encodeURIComponent(body.handoff_token)}&source=aishifokor`;

    const record = await this.prisma.aishifokorReferral.upsert({
      where: { handoffToken: body.handoff_token },
      create: {
        handoffToken: body.handoff_token,
        correlationId: body.correlation_id,
        aishifokorReferralId: payload?.referral_id ?? null,
        aishifokorAnalysisId: payload?.analysis_id ?? null,
        reason: payload?.reason ?? null,
        urgency: payload?.urgency || 'routine',
        payload: payload as object,
      },
      update: {
        correlationId: body.correlation_id,
        aishifokorReferralId: payload?.referral_id ?? null,
        aishifokorAnalysisId: payload?.analysis_id ?? null,
        reason: payload?.reason ?? null,
        urgency: payload?.urgency || 'routine',
        payload: payload as object,
      },
    });

    return {
      consultation_id: record.consultationId,
      open_url: openUrl,
      referral_id: record.id,
    };
  }

  async resolveHandoffForUt(token: string) {
    let record = await this.prisma.aishifokorReferral.findUnique({
      where: { handoffToken: token },
    });

    let payload: AishifokorHandoffPayload;
    if (record?.payload && typeof record.payload === 'object') {
      payload = record.payload as unknown as AishifokorHandoffPayload;
    } else {
      payload = await this.fetchHandoff(token);
      record = await this.prisma.aishifokorReferral.upsert({
        where: { handoffToken: token },
        create: {
          handoffToken: token,
          correlationId: payload.correlation_id,
          aishifokorReferralId: payload.referral_id ?? null,
          aishifokorAnalysisId: payload.analysis_id ?? null,
          reason: payload.reason ?? null,
          urgency: payload.urgency || 'routine',
          payload: payload as object,
        },
        update: {
          correlationId: payload.correlation_id,
          aishifokorReferralId: payload.referral_id ?? null,
          aishifokorAnalysisId: payload.analysis_id ?? null,
          reason: payload.reason ?? null,
          urgency: payload.urgency || 'routine',
          payload: payload as object,
        },
      });
    }

    return { record, payload, prefill: this.buildUtPrefill(payload) };
  }

  buildUtPrefill(payload: AishifokorHandoffPayload) {
    const p = payload.patient || {};
    const clinical = payload.clinical || {};
    const parts = [p.last_name, p.first_name, p.father_name].filter(Boolean);
    const fullName = parts.join(' ').trim();

    let birthDate = '';
    const ageNum = parseInt(String(p.age || '').replace(/\D/g, ''), 10);
    if (!Number.isNaN(ageNum) && ageNum > 0 && ageNum < 120) {
      const year = new Date().getFullYear() - ageNum;
      birthDate = `${year}-01-01`;
    }

    const genderRaw = (p.gender || '').toLowerCase();
    const gender = genderRaw === 'female' || genderRaw === 'ayol' ? 'FEMALE' : 'MALE';

    const dxList = clinical.consensus_diagnosis || [];
    const summaryParts: string[] = [];
    if (clinical.summary) summaryParts.push(clinical.summary);
    if (dxList.length) summaryParts.push(`AI differensial: ${dxList.join('; ')}`);
    if (clinical.red_flags?.length) {
      summaryParts.push(`Qizil bayroqlar: ${clinical.red_flags.join('; ')}`);
    }
    if (payload.clinician_note) summaryParts.push(`Izoh: ${payload.clinician_note}`);
    if (typeof clinical.confidence_score === 'number') {
      summaryParts.push(`AI ishonch: ${Math.round(clinical.confidence_score * 100)}%`);
    }

    let complaints = (p.complaints || '').trim();
    if (summaryParts.length) {
      const block = summaryParts.join('\n');
      complaints = complaints ? `${complaints}\n\n--- AiShifokor ---\n${block}` : block;
    }

    return {
      fullName,
      passportNumber: p.registry_number || '',
      birthDate,
      gender,
      phone: p.phone || '',
      complaints: complaints.slice(0, 4000),
      urgency: payload.urgency || 'routine',
      reason: payload.reason || 'manual',
      analysisId: payload.analysis_id ?? null,
      referralId: payload.referral_id ?? null,
      fhirBundleUrl: payload.fhir_bundle_url || '',
      referrerName: payload.referrer?.name || '',
    };
  }

  async linkConsultation(
    handoffToken: string,
    consultationId: string,
    user: { role: string; facilityId: string | null },
  ) {
    const record = await this.prisma.aishifokorReferral.findUnique({
      where: { handoffToken },
    });
    if (!record) throw new NotFoundException('AiShifokor yo\'naltirish topilmadi');

    // Operator faqat O'Z muassasasidagi konsultatsiyani bog'lay oladi — aks holda
    // token bilan istalgan konsultatsiyaning ustuvorligini o'zgartirish mumkin edi.
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { utId: true },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    if (user.role !== 'ADMIN' && consultation.utId !== user.facilityId) {
      throw new ForbiddenException('Bu konsultatsiyaga kirish huquqi yo\'q');
    }
    if (record.consultationId && record.consultationId !== consultationId) {
      throw new BadRequestException('Bu yo\'naltirish boshqa konsultatsiyaga bog\'langan');
    }

    const priority =
      record.urgency === 'urgent'
        ? 15
        : record.reason === 'emergency_routing' || record.reason === 'red_flags'
          ? 12
          : 5;

    await this.prisma.$transaction([
      this.prisma.aishifokorReferral.update({
        where: { id: record.id },
        data: { consultationId },
      }),
      this.prisma.consultation.update({
        where: { id: consultationId },
        data: {
          priority,
          triageNotes: record.reason
            ? `AiShifokor: ${record.reason}${record.aishifokorAnalysisId ? ` (#${record.aishifokorAnalysisId})` : ''}`
            : undefined,
        },
      }),
    ]);

    return { linked: true, referralId: record.id };
  }

  async notifyConsultationCompleted(
    consultationId: string,
    diagnosis: string,
    icd10Code?: string | null,
  ) {
    if (!this.isConfigured()) return;

    const record = await this.prisma.aishifokorReferral.findFirst({
      where: { consultationId },
    });
    if (!record || record.callbackSentAt) return;

    const summary = [
      diagnosis,
      icd10Code ? `ICD-10: ${icd10Code}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const base = this.apiBase();
    const url = `${base}/integrations/ishifo/callback/`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          correlation_id: record.correlationId,
          referral_id: record.aishifokorReferralId,
          consultation_id: consultationId,
          status: 'completed',
          diagnosis_summary: summary,
          final_diagnosis: diagnosis,
          icd10_code: icd10Code || undefined,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      }

      await this.prisma.aishifokorReferral.update({
        where: { id: record.id },
        data: { callbackSentAt: new Date(), callbackError: null },
      });
      this.logger.log(`AiShifokor callback OK — consultation ${consultationId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AiShifokor callback failed (${consultationId}): ${message}`);
      await this.prisma.aishifokorReferral.update({
        where: { id: record.id },
        data: { callbackError: message.slice(0, 500) },
      });
    }
  }
}
