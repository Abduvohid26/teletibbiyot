import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../common/access-control.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AishifokorApiGuard } from './aishifokor-api.guard';
import { AishifokorService } from './aishifokor.service';
import { AishifokorReferralPushDto } from './aishifokor.dto';

class LinkConsultationDto {
  @IsString()
  @MinLength(8)
  handoffToken!: string;

  @IsString()
  @MinLength(8)
  consultationId!: string;
}

@ApiTags('Integrations')
@Controller('integrations/aishifokor')
export class AishifokorController {
  constructor(private readonly aishifokor: AishifokorService) {}

  /** AiShifokor server push — yangi yo'naltirish */
  @Post('referral')
  @UseGuards(AishifokorApiGuard)
  acceptReferral(@Body() body: AishifokorReferralPushDto) {
    return this.aishifokor.acceptPush({
      correlation_id: body.correlation_id,
      handoff_token: body.handoff_token,
      handoff_url: body.handoff_url,
      payload: body.payload as unknown as import('./aishifokor.types').AishifokorHandoffPayload,
    });
  }

  /** UT operator — handoff token orqali bemor ma'lumotini olish */
  @Get('handoff/:token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.UT_OPERATOR, UserRole.ADMIN)
  async getHandoff(@Param('token') token: string) {
    const { payload, prefill, record } = await this.aishifokor.resolveHandoffForUt(token);
    return {
      payload,
      prefill,
      linkedConsultationId: record.consultationId,
    };
  }

  /** Konsultatsiya yaratilgach — AiShifokor bilan bog'lash */
  @Post('link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.UT_OPERATOR, UserRole.ADMIN)
  linkConsultation(@Body() body: LinkConsultationDto, @Request() req: { user: AuthUser }) {
    return this.aishifokor.linkConsultation(body.handoffToken, body.consultationId, req.user);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  status() {
    return {
      configured: this.aishifokor.isConfigured(),
    };
  }
}
