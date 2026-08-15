import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

export type SfuVideoRole = 'mt' | 'ut' | 'observe';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);

  constructor(private config: ConfigService) {}

    isEnabled(): boolean {
    if (this.config.get('E2E') === 'true') return false;
    if (this.config.get('LIVEKIT_ENABLED') !== 'true') return false;
    const key = this.config.get<string>('LIVEKIT_API_KEY');
    const secret = this.config.get<string>('LIVEKIT_API_SECRET');
    const url = this.publicUrl();
    return Boolean(key && secret && url);
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
