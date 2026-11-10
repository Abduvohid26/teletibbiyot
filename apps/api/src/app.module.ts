import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { AiModule } from './ai/ai.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { DevicesModule } from './devices/devices.module';
import { VideoModule } from './video/video.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { StorageModule } from './storage/storage.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditModule } from './audit/audit.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';

import { ReportsModule } from './reports/reports.module';
import { RecordingsModule } from './recordings/recordings.module';
import { MessagesModule } from './messages/messages.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { TemplatesModule } from './templates/templates.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { MetricsModule } from './metrics/metrics.module';
import { ComplianceModule } from './compliance/compliance.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { resolveRootEnvPath } from './env.config';

const throttleLimit =
  process.env.NODE_ENV === 'production' && process.env.E2E !== 'true' ? 100 : 2000;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveRootEnvPath(),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: throttleLimit }]),
    CommonModule,
    PrismaModule,
    NotificationsModule,
    HealthModule,
    MetricsModule,
    ComplianceModule,
    IntegrationsModule,
    StorageModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    ConsultationsModule,
    AiModule,
    FacilitiesModule,
    DevicesModule,
    VideoModule,
    DashboardModule,
    AttachmentsModule,
    AuditModule,
    AnalyticsModule,
    ReportsModule,
    RecordingsModule,
    MessagesModule,
    AppointmentsModule,
    TemplatesModule,
    SpecialtiesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
