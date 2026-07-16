import { Body, Controller, Get, Param, Post, Query, Req, Request, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../common/access-control.service';
import { ComplianceFacade } from './compliance.facade';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

class IncidentDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

class ConsentAuditQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

@ApiTags('Compliance')
@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private compliance: ComplianceFacade) {}

  @Get('retention/status')
  @Roles(UserRole.ADMIN)
  retentionStatus() {
    return this.compliance.retentionStatus();
  }

  @Post('retention/run')
  @Roles(UserRole.ADMIN)
  runRetention(@Request() req: { user: AuthUser }) {
    return this.compliance.runRetention(req.user.id);
  }

  @Get('export/patient/:id')
  @Roles(UserRole.ADMIN)
  exportPatient(
    @Param('id') id: string,
    @Request() req: { user: AuthUser },
    @Req() expressReq: ExpressRequest,
  ) {
    return this.compliance.exportPatient(id, req.user.id, expressReq.ip);
  }

  @Get('consent-audit')
  @Roles(UserRole.ADMIN)
  consentAudit(@Query() query: ConsentAuditQuery) {
    return this.compliance.consentAudit(query.limit);
  }

  @Post('incidents')
  @Roles(UserRole.MT_DOCTOR, UserRole.UT_OPERATOR)
  reportIncident(
    @Body() dto: IncidentDto,
    @Request() req: { user: AuthUser },
    @Req() expressReq: ExpressRequest,
  ) {
    return this.compliance.logIncident({
      userId: req.user.id,
      title: dto.title,
      description: dto.description,
      severity: dto.severity,
      ip: expressReq.ip,
    });
  }
}
