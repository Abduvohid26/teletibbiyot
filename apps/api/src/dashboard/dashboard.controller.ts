import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../common/access-control.service';
import {
  ROLES_ADMIN,
  ROLES_MT_STAFF,
  ROLES_UT,
} from '../common/roles.constants';

@ApiTags('Dashboard')
@Controller('dashboard')
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(...ROLES_MT_STAFF)
  getStats(@Request() req: { user: AuthUser }) {
    return this.dashboardService.getStats(req.user);
  }

  @Get('active-consultation')
  @Roles(UserRole.MT_DOCTOR)
  getActiveConsultation(
    @Request() req: { user: { id: string } },
    @Query('id') preferredId?: string,
  ) {
    return this.dashboardService.getActiveConsultation(req.user.id, preferredId);
  }

  @Get('ut-active-consultation')
  @Roles(...ROLES_UT)
  getUtActiveConsultation(
    @Request() req: { user: { facilityId: string | null } },
    @Query('id') preferredId?: string,
  ) {
    return this.dashboardService.getUtActiveConsultation(req.user.facilityId, preferredId);
  }

  @Get('ut-in-progress-consultations')
  @Roles(...ROLES_UT)
  getUtInProgressConsultations(
    @Request() req: { user: { facilityId: string | null } },
  ) {
    return this.dashboardService.getUtInProgressConsultations(req.user.facilityId);
  }

  @Get('ut-session-consultations')
  @Roles(...ROLES_UT)
  getUtSessionConsultations(
    @Request() req: { user: { facilityId: string | null } },
  ) {
    return this.dashboardService.getUtSessionConsultations(req.user.facilityId);
  }

  @Get('in-progress-consultations')
  @Roles(...ROLES_MT_STAFF)
  getInProgressConsultations(@Request() req: { user: AuthUser }) {
    return this.dashboardService.getInProgressConsultations(req.user);
  }

  @Get('sla-metrics')
  @Roles(UserRole.ADMIN)
  getSlaMetrics(@Request() req: { user: AuthUser }) {
    return this.dashboardService.getSlaMetrics(req.user);
  }

  @Get('admin-overview')
  @Roles(UserRole.ADMIN)
  getAdminOverview() {
    return this.dashboardService.getAdminOverview();
  }
}
