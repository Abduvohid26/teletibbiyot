import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from '../common/dto/common.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES_ADMIN, ROLES_CLINICAL } from '../common/roles.constants';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(...ROLES_ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('doctors')
  @Roles(...ROLES_CLINICAL)
  @ApiOperation({ summary: 'Faol shifokorlar ro\'yxati' })
  findDoctors() {
    return this.usersService.findDoctors();
  }

  @Post()
  @Roles(...ROLES_ADMIN)
  create(@Body() body: CreateUserDto, @Request() req: { user: { id: string } }) {
    return this.usersService.create(body, req.user.id);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMIN)
  @ApiOperation({ summary: 'Foydalanuvchini yangilash' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.usersService.update(id, body, req.user.id);
  }

  @Post(':id/reset-password')
  @Roles(...ROLES_ADMIN)
  @ApiOperation({ summary: 'Parolni qayta o\'rnatish' })
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(id, dto.password);
  }

  @Patch(':id/toggle-active')
  @Roles(...ROLES_ADMIN)
  toggleActive(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.usersService.toggleActive(id, req.user.id);
  }
}
