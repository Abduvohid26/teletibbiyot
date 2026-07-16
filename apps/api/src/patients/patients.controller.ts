import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ROLES_CLINICAL } from '../common/roles.constants';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Post()
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'Yangi bemor ro\'yxatdan o\'tkazish' })
  create(
    @Body() dto: CreatePatientDto,
    @Request() req: { user: { id: string; role: UserRole; facilityId: string | null } },
    @Req() expressReq: { ip?: string },
  ) {
    return this.patientsService.create(dto, req.user, expressReq.ip);
  }

  @Get()
  @Roles(...ROLES_CLINICAL)
  findAll(
    @Query() query: PatientQueryDto,
    @Request() req: { user: { id: string; role: UserRole; facilityId: string | null } },
  ) {
    return this.patientsService.findAll(query, req.user);
  }

  @Get('pinfl/:pinfl')
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'PINFL bo\'yicha bemor qidirish' })
  findByPinfl(
    @Param('pinfl') pinfl: string,
    @Request() req: { user: { id: string; role: UserRole; facilityId: string | null } },
  ) {
    return this.patientsService.findByPinfl(pinfl, req.user);
  }

  @Get(':id')
  @Roles(...ROLES_CLINICAL)
  findOne(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole; facilityId: string | null } },
  ) {
    return this.patientsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'Bemor ma\'lumotlarini yangilash' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @Request() req: { user: { id: string; role: UserRole; facilityId: string | null } },
  ) {
    return this.patientsService.update(id, dto, req.user);
  }
}
