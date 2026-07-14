import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES_ADMIN, ROLES_MT_DOCTOR } from '../common/roles.constants';

@ApiTags('Templates')
@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TemplatesController {
  constructor(private templates: TemplatesService) {}

  @Get('prescriptions')
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Retsept shablonlari' })
  list(@Query('all') all?: string) {
    return this.templates.findAll(all !== 'true');
  }

  @Get('prescriptions/:id')
  @Roles(...ROLES_MT_DOCTOR, ...ROLES_ADMIN)
  get(@Param('id') id: string) {
    return this.templates.findOne(id);
  }
}
