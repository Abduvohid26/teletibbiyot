import { Controller, Get, Param, Post, Query, Body, Request, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../common/access-control.service';
import { ROLES_MT_DOCTOR, ROLES_ADMIN } from '../common/roles.constants';
import { OneIdService } from './oneid.service';
import { PrescriptionService } from './prescription.service';
import { DicomService } from './dicom.service';
import { resolveAuthCookieOptions } from '../common/auth-cookie.util';
import { jwtExpiresInMs } from '../common/jwt-cookie.util';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString, Length } from 'class-validator';

class OneIdMockDto {
  @IsString()
  @Length(14, 14)
  pinfl!: string;

  @IsOptional()
  @IsString()
  role?: UserRole;
}

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private oneId: OneIdService,
    private prescription: PrescriptionService,
    private dicom: DicomService,
    private config: ConfigService,
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(...ROLES_ADMIN, UserRole.MT_MANAGER, UserRole.AUDITOR)
  status() {
    return {
      oneId: { enabled: this.oneId.isEnabled(), mock: this.config.get('ONEID_MOCK') === 'true' },
      prescription: { enabled: this.prescription.isEnabled() },
      dicom: { enabled: true },
      fieldEncryption: { enabled: !!this.config.get('ENCRYPTION_KEY') },
    };
  }

  @Get('oneid/login')
  oneIdLogin(@Res() res: Response) {
    const state = crypto.randomUUID();
    const url = this.oneId.getAuthorizationUrl(state);
    res.cookie('oneid_state', state, {
      ...resolveAuthCookieOptions(this.config),
      maxAge: 600_000,
    });
    return res.redirect(url);
  }

  @Get('oneid/callback')
  async oneIdCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Request() req: { cookies?: { oneid_state?: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!code || state !== req.cookies?.oneid_state) {
      return { error: 'OneID state yoki code noto\'g\'ri' };
    }
    const result = await this.oneId.exchangeCode(code);
    res.clearCookie('oneid_state', resolveAuthCookieOptions(this.config));
    const cookieMaxAge = jwtExpiresInMs(this.config.get('JWT_EXPIRES_IN'));
    res.cookie('token', result.accessToken, {
      ...resolveAuthCookieOptions(this.config),
      maxAge: cookieMaxAge,
    });
    const webUrl = this.config.get('WEB_APP_URL') || 'http://localhost:3000';
    return res.redirect(`${webUrl}/dashboard`);
  }

  @Post('oneid/mock')
  async oneIdMock(@Body() body: OneIdMockDto, @Res({ passthrough: true }) res: Response) {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new ForbiddenException('OneID mock productionda taqiqlangan');
    }
    const result = await this.oneId.mockLogin(body.pinfl, body.role);
    res.cookie('token', result.accessToken, {
      ...resolveAuthCookieOptions(this.config),
      maxAge: jwtExpiresInMs(this.config.get('JWT_EXPIRES_IN')),
    });
    return { user: result.user };
  }

  @Get('dicom/consultation/:consultationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN, UserRole.UT_OPERATOR)
  listDicom(@Param('consultationId') consultationId: string, @Request() req: { user: AuthUser }) {
    return this.dicom.listConsultationStudies(consultationId, req.user);
  }

  @Get('dicom/attachment/:attachmentId/view')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN, UserRole.UT_OPERATOR)
  viewDicom(@Param('attachmentId') attachmentId: string, @Request() req: { user: AuthUser }) {
    return this.dicom.getViewerUrl(attachmentId, req.user);
  }

  @Post('prescription/:consultationId/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  async submitPrescription(
    @Param('consultationId') consultationId: string,
    @Request() req: { user: AuthUser },
  ) {
    const payload = await this.prescription.buildFromConsultation(consultationId, req.user);
    return this.prescription.submitToNationalRegistry(payload);
  }
}
