import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { describeSignalUrlProblem, isBrowserReachableSignalUrl } from '@ishifo/shared';

export type SfuVideoRole = 'mt' | 'ut' | 'observe';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private warnedUnreachable = false;

  constructor(private config: ConfigService) {}

  isEnabled(): boolean {
    // E2E'da LiveKit sukut bo'yicha o'chiriladi (testlar P2P yo'lini sinaydi).
    // AMMO production endi SFU'da ishlaydi — o'sha yo'lni ham sinash imkoni
    // bo'lishi SHART, aks holda ishlatilayotgan kod umuman qoplanmaydi.
    // E2E_LIVEKIT=true bilan aynan shu suite SFU rejimida qayta yuritiladi.
    if (this.config.get('E2E') === 'true' && this.config.get('E2E_LIVEKIT') !== 'true') {
      return false;
    }
    if (this.config.get('LIVEKIT_ENABLED') !== 'true') return false;
    const key = this.config.get<string>('LIVEKIT_API_KEY');
    const secret = this.config.get<string>('LIVEKIT_API_SECRET');
    const url = this.publicUrl();
    if (!key || !secret || !url) return false;

    // MUHIM: brauzer yeta olmaydigan URL (ws://localhost:7880) bilan SFU'ni
    // "yoqilgan" deb e'lon qilish — klientni ataylab yiqiladigan ulanishga
    // yuborish demak. U ulanolmay, timeout kutib, keyin P2P ga qaytadi:
    // foydalanuvchi bir necha soniya qora ekran ko'radi. Bunday holatda
    // DARHOL P2P ni tanlagan ma'qul.
    // E2E'da hamma narsa BITTA mashinada ishlaydi — u yerda `localhost`
    // haqiqatan to'g'ri manzil. Tekshiruv faqat real deploy uchun.
    const isLocalE2E = this.config.get('E2E_LIVEKIT') === 'true';
    if (!isLocalE2E && !isBrowserReachableSignalUrl(url)) {
      if (!this.warnedUnreachable) {
        this.warnedUnreachable = true;
        this.logger.error(
          `LIVEKIT o'CHIRILDI — ${describeSignalUrlProblem(url)} (LIVEKIT_PUBLIC_URL=${url}). P2P rejimga qaytildi.`,
        );
      }
      return false;
    }
    return true;
  }

  /** Ishga tushirishda holatni bir marta aytish uchun */
  diagnose(): { enabled: boolean; url: string; problem: string | null } {
    const url = this.publicUrl();
    return {
      enabled: this.isEnabled(),
      url,
      problem: url ? describeSignalUrlProblem(url) : 'LIVEKIT_PUBLIC_URL o\'rnatilmagan',
    };
  }

  publicUrl(): string {
    return (
      this.config.get<string>('LIVEKIT_PUBLIC_URL')
      || this.config.get<string>('NEXT_PUBLIC_LIVEKIT_URL')
      || ''
    ).trim();
  }

  async mintToken(params: {
    identity: string;
    name: string;
    roomName: string;
    role: SfuVideoRole;
  }): Promise<{ url: string; token: string; room: string }> {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY') ?? '';
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET') ?? '';
    const at = new AccessToken(apiKey, apiSecret, {
      identity: params.identity,
      name: params.name,
      ttl: '6h',
      metadata: JSON.stringify({ role: params.role }),
    });
    at.addGrant({
      roomJoin: true,
      room: params.roomName,
      canPublish: params.role !== 'observe',
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });
    const token = await at.toJwt();
    this.logger.debug(`SFU token: ${params.identity} → ${params.roomName} (${params.role})`);
    return { url: this.publicUrl(), token, room: params.roomName };
  }
}
