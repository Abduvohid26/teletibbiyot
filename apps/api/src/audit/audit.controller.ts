import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES_ADMIN_AUDITOR } from '../common/roles.constants';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('logs')
  @Roles(...ROLES_ADMIN_AUDITOR)
  findAll(
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.findAll({
      limit: limit ? parseInt(limit) : 100,
      action,
      entity,
      userId,
      from,
      to,
    });
  }

  @Get('export/csv')
  @Roles(...ROLES_ADMIN_AUDITOR)
  @ApiOperation({ summary: 'Audit jurnalini CSV eksport' })
  async exportCsv(
    @Query('action') action: string | undefined,
    @Query('entity') entity: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.auditService.exportCsv({ action, entity, from, to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-jurnal.csv"');
    return res.send('\uFEFF' + csv);
  }
}
