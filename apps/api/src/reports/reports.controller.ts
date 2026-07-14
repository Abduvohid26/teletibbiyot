import { Controller, Get, Post, Param, UseGuards, Request, Res, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../common/access-control.service';
import { ROLES_ADMIN, ROLES_CLINICAL_ADMIN, ROLES_MT_DOCTOR } from '../common/roles.constants';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Post(':consultationId/generate')
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Konsultatsiya hisobotini yaratish' })
  generate(@Param('consultationId') consultationId: string, @Request() req: { user: AuthUser }) {
    return this.reports.generateReport(consultationId, req.user);
  }

  @Get(':consultationId/link')
  @Roles(...ROLES_CLINICAL_ADMIN)
  @ApiOperation({ summary: 'Hisobot havolasini olish' })
  async getLink(@Param('consultationId') consultationId: string, @Request() req: { user: AuthUser }) {
    const url = await this.reports.getDownloadUrl(consultationId, req.user);
    return { url };
  }

  @Get(':consultationId/download')
  @Roles(...ROLES_CLINICAL_ADMIN)
  @ApiOperation({ summary: 'Hisobotni yuklab olish' })
  async download(
    @Param('consultationId') consultationId: string,
    @Request() req: { user: AuthUser },
    @Res() res: Response,
    @Req() expressReq: { ip?: string },
  ) {
    const url = await this.reports.getDownloadUrl(consultationId, req.user, expressReq.ip);
    return res.redirect(url);
  }
}
