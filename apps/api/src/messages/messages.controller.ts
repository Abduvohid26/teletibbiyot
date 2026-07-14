import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { SendMessageDto } from '../common/dto/common.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../common/access-control.service';
import { ROLES_CLINICAL_ADMIN } from '../common/roles.constants';

@ApiTags('Messages')
@Controller('consultations/:consultationId/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  @Roles(...ROLES_CLINICAL_ADMIN)
  @ApiOperation({ summary: 'Konsultatsiya chat tarixi' })
  list(@Param('consultationId') consultationId: string, @Request() req: { user: AuthUser }) {
    return this.messages.list(consultationId, req.user);
  }

  @Post()
  @Roles(...ROLES_CLINICAL_ADMIN)
  send(
    @Param('consultationId') consultationId: string,
    @Body() dto: SendMessageDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.messages.send(consultationId, req.user, dto.message);
  }
}
