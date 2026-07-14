import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceFacade } from './compliance.facade';
import { RetentionService } from './retention.service';

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [ComplianceController],
  providers: [RetentionService, ComplianceFacade],
  exports: [RetentionService],
})
export class ComplianceModule {}
