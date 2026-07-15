import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AuthUser } from '../common/access-control.service';
import { ROLES_ADMIN, ROLES_CLINICAL, ROLES_MT_STAFF, ROLES_UT } from '../common/roles.constants';

class SearchQueryDto {
  @IsString()
  @MinLength(2)
  q: string;
}

type AuthReq = { user: AuthUser };

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('overview')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN, ...ROLES_UT)
  @ApiOperation({ summary: 'Analitika umumiy ko\'rsatkichlar' })
  overview(@Query() query: AnalyticsQueryDto, @Request() req: AuthReq) {
    return this.analyticsService.getOverview(query, req.user);
  }

  @Get('trends')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN, ...ROLES_UT)
  trends(@Query() query: AnalyticsQueryDto, @Request() req: AuthReq) {
    return this.analyticsService.getTrends(query, req.user);
  }

  @Get('triage')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN, ...ROLES_UT)
  triage(@Query() query: AnalyticsQueryDto, @Request() req: AuthReq) {
    return this.analyticsService.getTriageDistribution(query, req.user);
  }

  @Get('facilities')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN, ...ROLES_UT)
  facilities(@Query() query: AnalyticsQueryDto, @Request() req: AuthReq) {
    return this.analyticsService.getFacilityStats(query, req.user);
  }

  @Get('diagnoses')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN, ...ROLES_UT)
  diagnoses(@Query() query: AnalyticsQueryDto, @Request() req: AuthReq) {
    return this.analyticsService.getTopDiagnoses(query, req.user);
  }

  @Get('demographics')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN, ...ROLES_UT)
  demographics(@Request() req: AuthReq) {
    return this.analyticsService.getPatientDemographics(req.user);
  }

  @Get('ai-insights')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN, ...ROLES_UT)
  aiInsights(@Query() query: AnalyticsQueryDto, @Request() req: AuthReq) {
    return this.analyticsService.getAiInsights(query, req.user);
  }

  @Get('ai-agreement/doctors')
  @Roles(UserRole.MT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Shifokorlar bo\'yicha AI tashxis mosligi' })
  aiAgreementByDoctor(@Query() query: AnalyticsQueryDto, @Request() req: AuthReq) {
    return this.analyticsService.getAiAgreementByDoctor(query, req.user);
  }

  @Get('search')
  @Roles(...ROLES_CLINICAL, ...ROLES_ADMIN)
  search(@Query() query: SearchQueryDto, @Request() req: AuthReq) {
    return this.analyticsService.globalSearch(query.q, req.user);
  }

  @Get('filter-options')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN, ...ROLES_UT)
  filterOptions(@Request() req: AuthReq) {
    return this.analyticsService.getFilterOptions(req.user);
  }
}
