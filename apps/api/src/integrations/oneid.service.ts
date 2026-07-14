import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

export interface OneIdProfile {
  pinfl: string;
  fullName: string;
  email?: string;
}

@Injectable()
export class OneIdService {
  private readonly logger = new Logger(OneIdService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  isEnabled() {
    return this.config.get('ONEID_ENABLED') === 'true';
  }

  getAuthorizationUrl(state: string) {
    const clientId = this.config.get('ONEID_CLIENT_ID');
    const redirectUri = this.config.get('ONEID_REDIRECT_URI');
    if (!this.isEnabled() || !clientId || !redirectUri) {
      throw new ServiceUnavailableException('OneID integratsiyasi sozlanmagan');
    }
    const base = this.config.get('ONEID_AUTH_URL') || 'https://sso.egov.uz/sso/oauth/Authorization.do';
    const params = new URLSearchParams({
      response_type: 'one_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'myportal',
      state,
    });
    return `${base}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; user: unknown }> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('OneID integratsiyasi sozlanmagan');
    }

    const profile = await this.fetchProfile(code);
    const user = await this.findOrCreateUser(profile);
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ONEID_LOGIN',
        entity: 'User',
        entityId: user.id,
        details: { pinfl: profile.pinfl.slice(0, 4) + '**********' },
      },
    });

    return { accessToken, user };
  }

  /** Development/staging mock — ONEID_MOCK=true */
  async mockLogin(pinfl: string, role: UserRole = UserRole.UT_OPERATOR) {
    if (this.config.get('ONEID_MOCK') !== 'true') {
      throw new BadRequestException('OneID mock faqat ONEID_MOCK=true da ishlaydi');
    }
    const profile: OneIdProfile = {
      pinfl,
      fullName: `OneID Mock ${pinfl.slice(-4)}`,
      email: `oneid.${pinfl.slice(-6)}@ishifo.uz`,
    };
    const user = await this.findOrCreateUser(profile, role);
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion,
    });
    return { accessToken, user };
  }

  private async fetchProfile(code: string): Promise<OneIdProfile> {
    const tokenUrl = this.config.get('ONEID_TOKEN_URL') || 'https://sso.egov.uz/sso/oauth/Authorization.do';
    const clientId = this.config.get('ONEID_CLIENT_ID');
    const clientSecret = this.config.get('ONEID_CLIENT_SECRET');
    const redirectUri = this.config.get('ONEID_REDIRECT_URI');

    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'one_authorization_code',
          client_id: clientId || '',
          client_secret: clientSecret || '',
          redirect_uri: redirectUri || '',
          code,
        }),
      });
      if (!res.ok) throw new Error(`OneID token xato: ${res.status}`);
      const tokenData = (await res.json()) as { access_token?: string };
      if (!tokenData.access_token) throw new Error('OneID access_token yo\'q');

      const profileUrl = this.config.get('ONEID_PROFILE_URL') || 'https://sso.egov.uz/sso/oauth/Authorization.do';
      const profileRes = await fetch(profileUrl, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!profileRes.ok) throw new Error('OneID profil olish xato');
      const data = (await profileRes.json()) as { pinfl?: string; full_name?: string; email?: string };
      if (!data.pinfl || !data.full_name) throw new Error('OneID profil to\'liq emas');
      return { pinfl: data.pinfl, fullName: data.full_name, email: data.email };
    } catch (err) {
      this.logger.error(`OneID: ${err}`);
      throw new ServiceUnavailableException('OneID autentifikatsiya xato');
    }
  }

  private async findOrCreateUser(profile: OneIdProfile, defaultRole: UserRole = UserRole.UT_OPERATOR) {
    const email = profile.email || `oneid.${profile.pinfl}@ishifo.uz`;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return existing;

    const ut = await this.prisma.facility.findFirst({ where: { type: 'UT' } });
    const passwordHash = await bcrypt.hash(`oneid-${profile.pinfl}-${Date.now()}`, 12);
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: profile.fullName,
        role: defaultRole,
        facilityId: ut?.id,
        phone: null,
      },
      include: { facility: true },
    });
  }
}
