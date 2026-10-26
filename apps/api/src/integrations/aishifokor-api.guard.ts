import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

/** AiShifokor serverdan kelgan so'rovlar (shared API kalit). */
@Injectable()
export class AishifokorApiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = (this.config.get<string>('AISHIFOKOR_API_KEY') || '').trim();
    if (!expected) {
      throw new UnauthorizedException('AISHIFOKOR_API_KEY sozlanmagan');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const headerKey = (req.headers['x-aishifokor-key'] as string | undefined)?.trim();
    const provided = auth || headerKey || '';
    // Doimiy vaqtli taqqoslash — kalitni javob vaqti orqali taxmin qilib bo'lmasin
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('API kalit noto\'g\'ri');
    }
    return true;
  }
}
