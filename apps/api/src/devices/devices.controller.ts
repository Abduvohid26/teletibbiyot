import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { AuthUser } from '../common/access-control.service';
import { ROLES_ADMIN, ROLES_CLINICAL, ROLES_UT } from '../common/roles.constants';

class UpdateDeviceDto {
  @IsBoolean()
  connected: boolean;

  @IsString()
  status: string;
}

class TelemetryDto {
  @IsString()
  metricType: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  raw?: Record<string, unknown>;
}

@ApiTags('Devices')
@Controller('devices')
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Get('mode')
  @Roles(...ROLES_UT, ...ROLES_CLINICAL, ...ROLES_ADMIN)
  getMode() {
    return this.devicesService.getDeviceMode();
  }

  @Get('facility/:facilityId')
  @Roles(...ROLES_UT, ...ROLES_CLINICAL, ...ROLES_ADMIN)
  getByFacility(@Param('facilityId') facilityId: string, @Request() req: { user: AuthUser }) {
    return this.devicesService.getByFacility(facilityId, req.user);
  }

  @Patch(':id')
  @Roles(...ROLES_UT, ...ROLES_ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateDeviceDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.devicesService.updateStatus(id, body.connected, body.status, req.user);
  }

  @Post(':id/telemetry')
  @Roles(...ROLES_UT, ...ROLES_CLINICAL, ...ROLES_ADMIN)
  ingestTelemetry(
    @Param('id') id: string,
    @Body() body: TelemetryDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.devicesService.ingestTelemetry(id, body.metricType, body.value, req.user, body.unit, body.raw);
  }

  @Get(':id/telemetry')
  @Roles(...ROLES_UT, ...ROLES_CLINICAL, ...ROLES_ADMIN)
  getTelemetry(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @Request() req: { user: AuthUser },
  ) {
    return this.devicesService.getTelemetry(id, req.user, limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50);
  }
}
