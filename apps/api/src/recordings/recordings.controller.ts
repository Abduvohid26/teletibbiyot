import { Controller, Get, Post, Param, UseGuards, Body, UseInterceptors, UploadedFile, BadRequestException, Request, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { RecordingsService } from './recordings.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../common/access-control.service';
import { ROLES_ADMIN, ROLES_CLINICAL_ADMIN, ROLES_MT_STAFF } from '../common/roles.constants';

@ApiTags('Recordings')
@Controller('recordings')
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RecordingsController {
  constructor(private recordings: RecordingsService) {}

  @Post(':consultationId/start')
  @Roles(...ROLES_CLINICAL_ADMIN)
  @ApiOperation({ summary: 'Konsultatsiya yozuvini boshlash' })
  start(@Param('consultationId') consultationId: string, @Request() req: { user: AuthUser }) {
    return this.recordings.startRecording(consultationId, req.user);
  }

  @Post(':consultationId/complete')
  @Roles(...ROLES_CLINICAL_ADMIN)
  @ApiOperation({ summary: 'Yozuvni yakunlash' })
  complete(
    @Param('consultationId') consultationId: string,
    @Request() req: { user: AuthUser },
    @Body('duration') duration?: number,
  ) {
    return this.recordings.completeRecording(consultationId, req.user, duration);
  }

  @Post(':consultationId/upload')
  @Roles(...ROLES_CLINICAL_ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Video yozuvni yuklash' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  upload(
    @Param('consultationId') consultationId: string,
    @Request() req: { user: AuthUser },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Video fayl tanlanmagan');
    return this.recordings.uploadChunk(consultationId, req.user, file.buffer, file.mimetype);
  }

  @Get('list/completed')
  @Roles(...ROLES_MT_STAFF, ...ROLES_ADMIN)
  @ApiOperation({ summary: 'Yakunlangan yozuvlar (QA)' })
  listCompleted(@Request() req: { user: AuthUser }, @Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 50;
    const capped = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 50;
    return this.recordings.listCompleted(req.user, capped);
  }

  @Get(':consultationId')
  @Roles(...ROLES_CLINICAL_ADMIN)
  @ApiOperation({ summary: 'Yozuv ma\'lumotlari' })
  get(@Param('consultationId') consultationId: string, @Request() req: { user: AuthUser }) {
    return this.recordings.getRecording(consultationId, req.user);
  }
}
