import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FacilitiesService } from './facilities.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateFacilityDto, UpdateFacilityDto } from './dto/facility.dto';
import { ROLES_ADMIN, ROLES_CLINICAL, ROLES_UT, isUtRole } from '../common/roles.constants';

@ApiTags('Facilities')
@Controller('facilities')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FacilitiesController {
  constructor(private facilitiesService: FacilitiesService) {}

  @Get()
  @Roles(...ROLES_CLINICAL, ...ROLES_ADMIN)
  findAll() {
    return this.facilitiesService.findAll();
  }

  @Post()
  @Roles(...ROLES_ADMIN)
  @ApiOperation({ summary: 'Yangi muassasa yaratish' })
  create(@Body() body: CreateFacilityDto) {
    return this.facilitiesService.create(body);
  }

  @Get(':id')
  @Roles(...ROLES_CLINICAL, ...ROLES_ADMIN)
  findOne(
    @Param('id') id: string,
    @Request() req: { user: { role: string; facilityId: string | null } },
  ) {
    if (isUtRole(req.user.role) && req.user.facilityId !== id) {
      throw new ForbiddenException('Faqat o\'z muassasangiz ma\'lumotlariga kirish mumkin');
    }
    return this.facilitiesService.findOne(id);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMIN)
  @ApiOperation({ summary: 'Muassasa ma\'lumotlarini yangilash' })
  update(@Param('id') id: string, @Body() body: UpdateFacilityDto) {
    return this.facilitiesService.update(id, body);
  }
}
