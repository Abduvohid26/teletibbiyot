import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import { ROLES_CLINICAL_ADMIN } from '../common/roles.constants';

@ApiTags('Attachments')
@Controller('attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @Post('consultation/:consultationId')
  @Roles(...ROLES_CLINICAL_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(
    @Param('consultationId') consultationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { id: string; role: UserRole; facilityId: string | null } },
    @Req() expressReq: ExpressRequest,
  ) {
    if (!file) throw new BadRequestException('Fayl tanlanmagan');
    const ip = expressReq.ip || expressReq.headers['x-forwarded-for']?.toString();
    return this.attachmentsService.upload(consultationId, file, req.user, ip);
  }

  @Get('consultation/:consultationId')
  @Roles(...ROLES_CLINICAL_ADMIN)
  list(
    @Param('consultationId') consultationId: string,
    @Request() req: { user: { id: string; role: UserRole; facilityId: string | null } },
  ) {
    return this.attachmentsService.list(consultationId, req.user);
  }

  @Post('consultation/:consultationId/finalize')
  @Roles(...ROLES_CLINICAL_ADMIN)
  finalize(
    @Param('consultationId') consultationId: string,
    @Request() req: { user: { id: string; role: UserRole; facilityId: string | null } },
  ) {
    return this.attachmentsService.finalizeUploads(consultationId, req.user);
  }

  @Get(':id/download')
  @Roles(...ROLES_CLINICAL_ADMIN)
  download(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole; facilityId: string | null } },
    @Req() expressReq: ExpressRequest,
  ) {
    const ip = expressReq.ip || expressReq.headers['x-forwarded-for']?.toString();
    return this.attachmentsService.getDownloadUrl(id, req.user, ip);
  }
}
