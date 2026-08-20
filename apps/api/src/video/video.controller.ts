import { Controller, Get, Param, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { ICE_SERVERS } from '../common/video-ice.config';
import { ROLES_CLINICAL, ROLES_ADMIN, isMtDoctor, isUtRole } from '../common/roles.constants';
import { diagnoseTurnConfig, resolvePublicTurnUrl } from '../common/turn-url.util';
import { createEphemeralTurnCredentials } from '../common/turn-credentials';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { LivekitService, type SfuVideoRole } from './livekit.service';

@ApiTags('Video')
@Controller('video')
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class VideoController {
  constructor(
    private config: ConfigService,
    private livekit: LivekitService,
    private prisma: PrismaService,
    private access: AccessControlService,
  ) {}

  @Get('sfu-token/:consultationId')
  @Roles(...ROLES_CLINICAL, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'LiveKit SFU token (Google Meet uslubidagi media server)' })
  async getSfuToken(
    @Param('consultationId') consultationId: string,
    @Request() req: { user: AuthUser },
    @Query('role') roleQuery?: string,
  ) {
    if (!this.livekit.isEnabled()) {
      return { enabled: false as const };
    }

    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true, utId: true, mtDoctorId: true, status: true },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(req.user, consultation);

    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { fullName: true },
    });

    let role: SfuVideoRole = 'observe';
    if (roleQuery === 'observe' || roleQuery === 'mt' || roleQuery === 'ut') {
      role = roleQuery;
    } else if (isUtRole(req.user.role)) {
      role = 'ut';
    } else if (isMtDoctor(req.user.role)) {
      role = 'mt';
    }

    const minted = await this.livekit.mintToken({
      identity: req.user.id,
      name: user?.fullName || req.user.id,
      roomName: consultationId,
      role,
    });

    return { enabled: true as const, ...minted, role };
  }

  @Get('ice-config')
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'WebRTC ICE serverlar (STUN/TURN)' })
  getIceConfig(@Request() req: { user: AuthUser }) {
    const turnUrl = resolvePublicTurnUrl(this.config);
    const turnUser =
      this.config.get('TURN_PUBLIC_USERNAME') ||
      this.config.get('NEXT_PUBLIC_TURN_USERNAME') ||
      this.config.get('TURN_USERNAME');
    const turnPass =
      this.config.get('TURN_PUBLIC_PASSWORD') ||
      this.config.get('NEXT_PUBLIC_TURN_CREDENTIAL') ||
      this.config.get('TURN_PASSWORD');

    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [...ICE_SERVERS];

    // Sirli kalit bo'lsa — har so'rovga qisqa muddatli parol. Bo'lmasa eski
    // doimiy parolga qaytamiz (regressiya yo'q, lekin log'da ogohlantiramiz).
    const authSecret = this.config.get<string>('TURN_STATIC_SECRET')?.trim();
    const ephemeral = authSecret
      ? createEphemeralTurnCredentials(authSecret, req.user.id)
      : null;
    const credentialTtl = ephemeral ? ephemeral.ttl : null;

    if (turnUrl) {
      const creds = ephemeral
        ? { username: ephemeral.username, credential: ephemeral.credential }
        : { username: turnUser || undefined, credential: turnPass || undefined };
      const hostPart = turnUrl.replace(/^turns?:/i, '').split('@').pop()?.replace(/^\//, '') ?? turnUrl;
      iceServers.push({
        urls: [
          `turn:${hostPart}?transport=udp`,
          `turn:${hostPart}?transport=tcp`,
        ],
        ...creds,
      });
      iceServers.push({
        urls: [
          `turns:${hostPart}?transport=tcp`,
        ],
        ...creds,
      });
    }

    const diagnosis = diagnoseTurnConfig(this.config);

    return {
      iceServers,
      turnConfigured: !!turnUrl,
      // Klient shu muddat tugashidan oldin konfiguratsiyani yangilashi kerak.
      // null bo'lsa — doimiy parol, yangilash shart emas.
      credentialTtl,
      ephemeralCredentials: !!ephemeral,
      // Sozlash xatosining ANIQ sababi — "TURN yo'q" degan umumiy xabar
      // o'rniga qaysi o'zgaruvchi va nega noto'g'ri ekanini qaytaramiz.
      turnProblems: diagnosis.problems,
      recommendations: [
        !turnUrl ? 'TURN server sozlang — uzoq hudud NAT tarmoqlari uchun majburiy' : null,
        turnUrl && !authSecret
          ? 'TURN doimiy parol bilan ishlayapti — TURN_STATIC_SECRET o\'rnatib vaqtinchalik parolga o\'ting'
          : null,
        ...diagnosis.problems,
      ].filter(Boolean),
    };
  }
}
