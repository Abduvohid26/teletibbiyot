import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricsService {
  private httpRequestsTotal = 0;
  private httpErrorsTotal = 0;
  private startedAt = Date.now();

  constructor(private prisma: PrismaService) {}

  recordRequest(statusCode: number) {
    this.httpRequestsTotal += 1;
    if (statusCode >= 500) this.httpErrorsTotal += 1;
  }

  async collectPrometheus(): Promise<string> {
    let dbUp = 0;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbUp = 1;
    } catch {
      dbUp = 0;
    }

    const [consultationsQueued, consultationsActive, usersActive] = await Promise.all([
      this.prisma.consultation.count({ where: { status: 'QUEUED' } }),
      this.prisma.consultation.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);

    const uptimeSec = Math.floor((Date.now() - this.startedAt) / 1000);

    return [
      '# HELP ishifo_up API ishlayapti (1=ha)',
      '# TYPE ishifo_up gauge',
      'ishifo_up 1',
      '',
      '# HELP ishifo_db_up PostgreSQL ulanishi',
      '# TYPE ishifo_db_up gauge',
      `ishifo_db_up ${dbUp}`,
      '',
      '# HELP ishifo_uptime_seconds Ish vaqti',
      '# TYPE ishifo_uptime_seconds gauge',
      `ishifo_uptime_seconds ${uptimeSec}`,
      '',
      '# HELP ishifo_http_requests_total HTTP so\'rovlar',
      '# TYPE ishifo_http_requests_total counter',
      `ishifo_http_requests_total ${this.httpRequestsTotal}`,
      '',
      '# HELP ishifo_http_errors_total HTTP 5xx xatolar',
      '# TYPE ishifo_http_errors_total counter',
      `ishifo_http_errors_total ${this.httpErrorsTotal}`,
      '',
      '# HELP ishifo_consultations_queued Navbatdagi konsultatsiyalar',
      '# TYPE ishifo_consultations_queued gauge',
      `ishifo_consultations_queued ${consultationsQueued}`,
      '',
      '# HELP ishifo_consultations_active Jarayondagi konsultatsiyalar',
      '# TYPE ishifo_consultations_active gauge',
      `ishifo_consultations_active ${consultationsActive}`,
      '',
      '# HELP ishifo_users_active Faol foydalanuvchilar',
      '# TYPE ishifo_users_active gauge',
      `ishifo_users_active ${usersActive}`,
      '',
    ].join('\n');
  }
}
