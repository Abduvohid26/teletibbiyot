import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  Query,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ConsultationsService } from './consultations.service';
import {
  CreateConsultationDto,
  FinalDiagnosisDto,
  CancelConsultationDto,
  SecondOpinionDto,
  SecondOpinionResponseDto,
  EscalateConsultationDto,
} from './dto/consultation.dto';
import { ConsultationQueryDto } from './dto/consultation-query.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../common/access-control.service';
import {
  UpdateTriageDto,
  UpdatePriorityDto,
  UpdateClinicalNotesDto,
  UpdateFollowUpDto,
} from '../common/dto/common.dto';
import { UserRole } from '@prisma/client';
import {
  ROLES_ADMIN,
  ROLES_CLINICAL,
  ROLES_MT_DOCTOR,
  ROLES_MT_STAFF,
  ROLES_UT,
} from '../common/roles.constants';

@ApiTags('Consultations')
@Controller('consultations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ConsultationsController {
  constructor(private consultationsService: ConsultationsService) {}

  @Post()
  @Roles(...ROLES_UT)
  @ApiOperation({ summary: 'Yangi konsultatsiya yaratish va markazga yuborish' })
  create(@Body() dto: CreateConsultationDto, @Request() req: { user: { id: string; facilityId: string | null } }) {
    if (!req.user.facilityId) throw new ForbiddenException('UT muassasasi biriktirilmagan');
    return this.consultationsService.create(dto, req.user.facilityId, req.user.id);
  }

  @Get('queue')
  @SkipThrottle()
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN, ...ROLES_UT)
  @ApiOperation({ summary: 'Navbatdagi konsultatsiyalar' })
  getQueue(@Request() req: { user: AuthUser }) {
    return this.consultationsService.findQueue(req.user);
  }

  @Get('list')
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'Konsultatsiyalar ro\'yxati (filter va qidiruv)' })
  findAll(@Query() query: ConsultationQueryDto, @Request() req: { user: AuthUser }) {
    return this.consultationsService.findAll(query, req.user);
  }

  @Get('export/csv')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Konsultatsiyalar CSV eksport' })
  async exportCsv(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Request() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const csv = await this.consultationsService.exportCsv(req.user, from, to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="konsultatsiyalar.csv"');
    return res.send('\uFEFF' + csv);
  }

  @Get('patient/:patientId/history')
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'Bemor konsultatsiya tarixi' })
  getHistory(@Param('patientId') patientId: string, @Request() req: { user: AuthUser }) {
    return this.consultationsService.getHistory(patientId, req.user);
  }

  @Get(':id')
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'Konsultatsiya tafsilotlari' })
  findOne(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.consultationsService.findOne(id, req.user);
  }

  @Post(':id/start')
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Konsultatsiyani boshlash' })
  start(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.consultationsService.start(id, req.user.id);
  }

  @Post(':id/complete')
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Konsultatsiyani yakunlash (AI Konsilium PDF)' })
  complete(
    @Param('id') id: string,
    @Body() dto: FinalDiagnosisDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.consultationsService.complete(id, req.user.id, dto);
  }

  @Post(':id/cancel')
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'Konsultatsiyani bekor qilish' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelConsultationDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.consultationsService.cancel(id, req.user, dto.reason);
  }

  @Post(':id/escalate')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Konsultatsiyani eskalatsiya qilish' })
  escalate(
    @Param('id') id: string,
    @Body() dto: EscalateConsultationDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.consultationsService.escalate(id, req.user, dto.level as 'SENIOR_REVIEW' | 'EMERGENCY', dto.reason);
  }

  @Post(':id/second-opinion')
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Ikkinchi fikr so\'rash' })
  requestSecondOpinion(
    @Param('id') id: string,
    @Body() dto: SecondOpinionDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.consultationsService.requestSecondOpinion(id, req.user, dto);
  }

  @Post('second-opinion/:opinionId/respond')
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Ikkinchi fikrga javob berish' })
  respondSecondOpinion(
    @Param('opinionId') opinionId: string,
    @Body() dto: SecondOpinionResponseDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.consultationsService.respondSecondOpinion(opinionId, req.user, dto);
  }

  @Patch(':id/triage')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Triage darajasini qo\'lda o\'zgartirish' })
  updateTriage(
    @Param('id') id: string,
    @Body() body: UpdateTriageDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.consultationsService.updateTriage(id, req.user, body.triageLevel, body.triageNotes);
  }

  @Patch(':id/priority')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Navbat ustuvorligini o\'zgartirish' })
  updatePriority(
    @Param('id') id: string,
    @Body() body: UpdatePriorityDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.consultationsService.updatePriority(id, req.user, body.priority);
  }

  @Patch(':id/notes')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Klinik eslatmalar' })
  updateNotes(
    @Param('id') id: string,
    @Body() body: UpdateClinicalNotesDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.consultationsService.updateNotes(id, req.user, body.clinicalNotes);
  }

  @Patch(':id/follow-up')
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'Qayta ko\'rik sanasini belgilash' })
  scheduleFollowUp(
    @Param('id') id: string,
    @Body() body: UpdateFollowUpDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.consultationsService.scheduleFollowUp(id, req.user, body.followUpDate);
  }
}
