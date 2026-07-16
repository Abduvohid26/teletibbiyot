import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SpecialtiesService } from './specialties.service';
import { CreateSpecialtyDto, UpdateSpecialtyDto } from './dto/specialty.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES_ADMIN, ROLES_CLINICAL } from '../common/roles.constants';

@ApiTags('Specialties')
@Controller('specialties')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SpecialtiesController {
  constructor(private specialtiesService: SpecialtiesService) {}

  @Get()
  @Roles(...ROLES_CLINICAL, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Yo\'nalishlar ro\'yxati' })
  findAll(@Query('all') all?: string) {
    return this.specialtiesService.findAll(all === '1' || all === 'true');
  }

  @Post()
  @Roles(...ROLES_ADMIN)
  create(@Body() dto: CreateSpecialtyDto) {
    return this.specialtiesService.create(dto);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateSpecialtyDto) {
    return this.specialtiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...ROLES_ADMIN)
  remove(@Param('id') id: string) {
    return this.specialtiesService.remove(id);
  }
}
