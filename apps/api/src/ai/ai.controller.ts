import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Res,
  Query,
  Headers,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AiService } from './ai.service';
import { MonitorVitalsService } from './monitor-vitals.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AiFeedbackDto, ConfirmAiStepDto } from '../consultations/dto/consultation.dto';
import { AiChatDto, ReadMonitorVitalsDto } from '../common/dto/common.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { ROLES_ADMIN, ROLES_CLINICAL, ROLES_MT_DOCTOR, ROLES_UT } from '../common/roles.constants';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AiController {
  constructor(
    private aiService: AiService,
    private monitorVitals: MonitorVitalsService,
    private prisma: PrismaService,
    private access: AccessControlService,
  ) {}

  private async assertConsultationAccess(user: AuthUser, consultationId: string) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    if (!consultation) throw new NotFoundException('Konsultatsiya topilmadi');
    this.access.assertConsultationAccess(user, consultation);
    return consultation;
  }

  @Get('consultations/:id/analysis-pdf')
  @Roles(...ROLES_CLINICAL, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'AI klinik xulosasini PDF yuklab olish' })
  async downloadAnalysisPdf(
    @Param('id') id: string,
    @Request() req: { user: AuthUser },
    @Res() res: Response,
    @Query('locale') localeQuery?: string,
    @Headers('x-locale') localeHeader?: string,
  ) {
    const { buffer, fileName } = await this.aiService.buildAnalysisPdf(id, req.user, localeQuery ?? localeHeader);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  }

  @Post('consultations/:id/monitor-vitals')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Roles(...ROLES_UT, ...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Patient monitor ekranidan vital o\'qish (AI vision)' })
  async readMonitorVitals(
    @Param('id') id: string,
    @Body() dto: ReadMonitorVitalsDto,
    @Request() req: { user: AuthUser },
  ) {
    await this.assertConsultationAccess(req.user, id);
    return this.monitorVitals.readFromImageBase64(dto.image, dto.mimeType ?? 'image/jpeg');
  }

  @Post('consultations/:id/analyze')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'AI tahlilni qayta ishga tushirish' })
  async analyze(
    @Param('id') id: string,
    @Request() req: { user: AuthUser },
    @Headers('x-locale') locale?: string,
  ) {
    await this.assertConsultationAccess(req.user, id);
    return this.aiService.analyzeConsultation(id, locale);
  }

  @Post('consultations/:id/chat')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'AI yordamchisi bilan suhbat' })
  async chat(
    @Param('id') id: string,
    @Body() dto: AiChatDto,
    @Request() req: { user: AuthUser },
    @Headers('x-locale') locale?: string,
  ) {
    await this.assertConsultationAccess(req.user, id);
    return this.aiService.chatWithAi(id, dto.question, locale);
  }

  @Post('consultations/:id/localize')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Roles(...ROLES_CLINICAL, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'AI xulosani interfeys tiliga o\'girish' })
  async localize(
    @Param('id') id: string,
    @Request() req: { user: AuthUser },
    @Headers('x-locale') locale?: string,
  ) {
    await this.assertConsultationAccess(req.user, id);
    return this.aiService.localizeAnalysis(id, locale);
  }

  @Post('consultations/:consultationId/steps/:stepId/confirm')
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'AI bosqichini shifokor tasdiqlashi' })
  async confirmStep(
    @Param('consultationId') consultationId: string,
    @Param('stepId') stepId: string,
    @Body() dto: ConfirmAiStepDto,
    @Request() req: { user: AuthUser },
  ) {
    await this.assertConsultationAccess(req.user, consultationId);
    return this.aiService.confirmStep(consultationId, stepId, req.user.id, dto.notes);
  }

  @Post('analyses/:id/feedback')
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'AI xulosasi bo\'yicha fikr-mulohaza' })
  async feedback(
    @Param('id') id: string,
    @Body() dto: AiFeedbackDto,
    @Request() req: { user: AuthUser },
  ) {
    const analysis = await this.prisma.aiAnalysis.findUnique({
      where: { id },
      include: { consultation: true },
    });
    if (!analysis) throw new NotFoundException('AI tahlil topilmadi');
    this.access.assertConsultationAccess(req.user, analysis.consultation);
    return this.aiService.submitFeedback(id, req.user.id, dto.rating, dto.comment);
  }
}
