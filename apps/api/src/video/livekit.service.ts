import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { describeSignalUrlProblem, isBrowserReachableSignalUrl } from '@ishifo/shared';

export type SfuVideoRole = 'mt' | 'ut' | 'observe';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private warnedUnreachable = false;
  private roomService: RoomServiceClient | null = null;

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

  /**
   * Server → LiveKit API manzili. Docker ichida `http://livekit:7880`
   * (LIVEKIT_API_URL), aks holda brauzer manzilidan (ws→http) chiqariladi.
   */
  private apiUrl(): string {
    const explicit = (this.config.get<string>('LIVEKIT_API_URL') || '').trim();
    if (explicit) return explicit;
    return this.publicUrl().replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
  }

  private rooms(): RoomServiceClient | null {
    if (!this.isEnabled()) return null;
    if (!this.roomService) {
      this.roomService = new RoomServiceClient(
        this.apiUrl(),
        this.config.get<string>('LIVEKIT_API_KEY') ?? '',
        this.config.get<string>('LIVEKIT_API_SECRET') ?? '',
      );
    }
    return this.roomService;
  }

  /**
   * Ishtirokchini SFU xonasidan server tomonda chiqarish (konsiliumdan olib
   * tashlanganda). Faqat klientga "chiq" deyish yetarli emas — u xonada
   * qolishi mumkin edi, token esa bir necha soat amal qiladi.
   */
  async removeParticipant(roomName: string, identity: string): Promise<void> {
    const rooms = this.rooms();
    if (!rooms) return;
    try {
      await rooms.removeParticipant(roomName, identity);
    } catch (err) {
      // Ishtirokchi SFU'ga ulanmagan bo'lsa "not found" — bu normal
      this.logger.debug(`SFU removeParticipant (${roomName}/${identity}): ${err}`);
    }
  }

  /** Konsultatsiya yakunlanganda SFU xonasini yopish — hamma uziladi */
  async closeRoom(roomName: string): Promise<void> {
    const rooms = this.rooms();
    if (!rooms) return;
    try {
      await rooms.deleteRoom(roomName);
    } catch (err) {
      this.logger.debug(`SFU deleteRoom (${roomName}): ${err}`);
    }
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
      // Rol metadata'da — ishtirokchi uni o'zi o'zgartira olmasligi kerak
      canUpdateOwnMetadata: false,
    });
    const token = await at.toJwt();
    this.logger.debug(`SFU token: ${params.identity} → ${params.roomName} (${params.role})`);
    return { url: this.publicUrl(), token, room: params.roomName };
  }
}
