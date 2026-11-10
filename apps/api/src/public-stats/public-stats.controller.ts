import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicStatsService } from './public-stats.service';

@ApiTags('Public')
@Controller('public')
export class PublicStatsController {
  constructor(private stats: PublicStatsService) {}

  /** Landing uchun ochiq statistika — kirish talab qilinmaydi, shaxsiy ma'lumot qaytarmaydi */
  @Get('stats')
  @Header('Cache-Control', 'public, max-age=60')
  getStats() {
    return this.stats.getStats();
  }
}
