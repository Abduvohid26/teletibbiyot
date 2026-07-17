import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MonitorVitalsResult {
  heartRate: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  spo2: number | null;
  temperature: number | null;
  respiratoryRate: number | null;
  detected: boolean;
  source: 'openai' | 'unavailable';
}

const MONITOR_VISION_PROMPT = `Siz patient monitor (tibbiy vital monitor) ekranini kameradan o'qiydigan AI yordamchisiz.
Faqat ekranda ANIQ ko'rinadigan raqamlarni oling. Taxmin qilmang.
JSON formatida javob bering:
{
  "heartRate": number|null,
  "bloodPressureSystolic": number|null,
  "bloodPressureDiastolic": number|null,
  "spo2": number|null,
  "temperature": number|null,
  "respiratoryRate": number|null,
  "detected": boolean
}
detected=true faqat ekranda kamida bitta vital raqam aniq ko'rinsa.
Ko'rinmasa null va detected=false.`;

const VISION_MODEL = 'gpt-4o-mini';

@Injectable()
export class MonitorVitalsService {
  private readonly logger = new Logger(MonitorVitalsService.name);

  constructor(private config: ConfigService) {}

  async readFromImageBase64(imageBase64: string, mime = 'image/jpeg'): Promise<MonitorVitalsResult> {
    const empty = this.emptyResult('unavailable');
    const cfg = this.getOpenAiConfig();
    if (!cfg) return empty;

    const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    if (!rawBase64 || rawBase64.length > 6 * 1024 * 1024) {
      this.logger.warn('Monitor vision: rasm juda katta yoki bo\'sh');
      return empty;
    }

    const dataUrl = `data:${mime};base64,${rawBase64}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          max_tokens: 300,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: MONITOR_VISION_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Patient monitor ekranidagi vital ko\'rsatkichlarni o\'qing. Faqat ekranda ko\'rinadigan raqamlar.',
                },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        this.logger.warn(`Monitor vision HTTP ${response.status}: ${errBody.slice(0, 300)}`);
        return empty;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) return empty;

      return this.parseResult(text);
    } catch (err) {
      this.logger.warn(`Monitor vision: ${err}`);
      return empty;
    }
  }

  private parseResult(text: string): MonitorVitalsResult {
    try {
      const p = JSON.parse(text) as Partial<MonitorVitalsResult>;
      const heartRate = this.clampNum(p.heartRate, 30, 250);
      const spo2 = this.clampNum(p.spo2, 50, 100);
      const sys = this.clampNum(p.bloodPressureSystolic, 60, 250);
      const dia = this.clampNum(p.bloodPressureDiastolic, 40, 150);
      const temperature = this.clampNum(p.temperature, 34, 42);
      const respiratoryRate = this.clampNum(p.respiratoryRate, 5, 60);
      const detected = Boolean(
        p.detected
        || heartRate != null
        || spo2 != null
        || sys != null
        || temperature != null,
      );
      return {
        heartRate,
        bloodPressureSystolic: sys,
        bloodPressureDiastolic: dia,
        spo2,
        temperature,
        respiratoryRate,
        detected,
        source: 'openai',
      };
    } catch {
      return this.emptyResult('unavailable');
    }
  }

  private clampNum(v: unknown, min: number, max: number): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    if (n < min || n > max) return null;
    return Math.round(n * 10) / 10;
  }

  private emptyResult(source: 'openai' | 'unavailable'): MonitorVitalsResult {
    return {
      heartRate: null,
      bloodPressureSystolic: null,
      bloodPressureDiastolic: null,
      spo2: null,
      temperature: null,
      respiratoryRate: null,
      detected: false,
      source,
    };
  }

  private getOpenAiConfig(): { apiKey: string; model: string } | null {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'your-openai-api-key-here') return null;
    return { apiKey, model: this.config.get('OPENAI_MODEL') || VISION_MODEL };
  }
}
