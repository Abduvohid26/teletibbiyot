import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AiFeedbackDto, ConfirmAiStepDto } from '../consultations/dto/consultation.dto';
import { AiChatDto } from '../common/dto/common.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { ROLES_ADMIN, ROLES_MT_DOCTOR } from '../common/roles.constants';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AiController {
  constructor(
    private aiService: AiService,
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

  @Post('consultations/:id/analyze')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'AI tahlilni qayta ishga tushirish' })
  async analyze(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    await this.assertConsultationAccess(req.user, id);
    return this.aiService.analyzeConsultation(id);
  }

  @Post('consultations/:id/chat')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'AI yordamchisi bilan suhbat' })
  async chat(
    @Param('id') id: string,
    @Body() dto: AiChatDto,
    @Request() req: { user: AuthUser },
  ) {
    await this.assertConsultationAccess(req.user, id);
    return this.aiService.chatWithAi(id, dto.question);
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
