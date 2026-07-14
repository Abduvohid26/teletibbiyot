import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';
const SENSITIVE_FIELDS = ['pinfl', 'passportNumber', 'phone'] as const;

@Injectable()
export class FieldCryptoService {
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const raw = config.get<string>('ENCRYPTION_KEY');
    if (raw && raw.length >= 32) {
      this.key = createHmac('sha256', 'ishifo-field-key').update(raw).digest();
    } else {
      this.key = null;
    }
  }

  isEnabled() {
    return this.key !== null;
  }

  encryptDeterministic(plaintext: string): string {
    if (!this.key || !plaintext) return plaintext;
    if (this.isEncrypted(plaintext)) return plaintext;
    const iv = createHmac('sha256', this.key).update(plaintext).digest().subarray(0, 12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${Buffer.concat([iv, tag, enc]).toString('base64url')}`;
  }

  decryptDeterministic(value: string): string {
    if (!this.key || !this.isEncrypted(value)) return value;
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64url');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  encryptRandom(plaintext: string): string {
    if (!this.key || !plaintext) return plaintext;
    if (this.isEncrypted(plaintext)) return plaintext;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}r:${Buffer.concat([iv, tag, enc]).toString('base64url')}`;
  }

  decryptRandom(value: string): string {
    if (!this.key || !value.startsWith(`${PREFIX}r:`)) return value;
    const raw = Buffer.from(value.slice(PREFIX.length + 2), 'base64url');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  isEncrypted(value: string | null | undefined): boolean {
    return !!value && value.startsWith(PREFIX);
  }

  protectPatientFields(data: Record<string, unknown>): Record<string, unknown> {
    const out = { ...data };
    if (out.pinfl && typeof out.pinfl === 'string' && !this.isEncrypted(out.pinfl)) {
      out.pinfl = this.encryptDeterministic(out.pinfl);
    }
    if (out.passportNumber && typeof out.passportNumber === 'string' && !this.isEncrypted(out.passportNumber)) {
      out.passportNumber = this.encryptDeterministic(out.passportNumber);
    }
    if (out.phone && typeof out.phone === 'string' && !this.isEncrypted(out.phone)) {
      out.phone = this.encryptDeterministic(out.phone);
    }
    return out;
  }

  unprotectPatient(patient: Record<string, unknown>): Record<string, unknown> {
    const out = { ...patient };
    for (const field of SENSITIVE_FIELDS) {
      if (out[field] && typeof out[field] === 'string') {
        const val = out[field] as string;
        out[field] = val.startsWith(`${PREFIX}r:`)
          ? this.decryptRandom(val)
          : this.decryptDeterministic(val);
      }
    }
    return out;
  }

  unprotectPatientFields(data: Record<string, unknown>): Record<string, unknown> {
    return this.unprotectPatient(data);
  }

  unprotectConsultation<C extends { patient?: Record<string, unknown> | null }>(consultation: C): C {
    if (!consultation.patient || typeof consultation.patient !== 'object') return consultation;
    return {
      ...consultation,
      patient: this.unprotectPatient(consultation.patient as Record<string, unknown>) as C['patient'],
    };
  }

  unprotectConsultations<C extends { patient?: Record<string, unknown> | null }>(items: C[]): C[] {
    return items.map((c) => this.unprotectConsultation(c));
  }
}
