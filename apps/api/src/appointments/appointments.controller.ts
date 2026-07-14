import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../common/access-control.service';
import { CreateAppointmentDto, UpdateAppointmentStatusDto } from './dto/appointment.dto';
import { ROLES_CLINICAL, ROLES_MT_STAFF } from '../common/roles.constants';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private appointments: AppointmentsService) {}

  @Post()
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'Qayta ko\'rik / uchrashuv rejalashtirish' })
  create(@Body() body: CreateAppointmentDto, @Request() req: { user: AuthUser }) {
    return this.appointments.create(req.user, body);
  }

  @Get('upcoming')
  @Roles(...ROLES_CLINICAL, ...ROLES_MT_STAFF)
  @ApiOperation({ summary: 'Yaqinlashayotgan uchrashuvlar' })
  upcoming(@Query('days') days: string | undefined, @Request() req: { user: AuthUser }) {
    return this.appointments.findUpcoming(req.user, days ? parseInt(days) : 7);
  }

  @Patch(':id/status')
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'Uchrashuv holatini yangilash' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateAppointmentStatusDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.appointments.updateStatus(id, req.user, body.status);
  }
}
