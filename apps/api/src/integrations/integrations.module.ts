import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { OneIdService } from './oneid.service';
import { PrescriptionService } from './prescription.service';
import { DicomService } from './dicom.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [IntegrationsController],
  providers: [OneIdService, PrescriptionService, DicomService],
  exports: [OneIdService, PrescriptionService, DicomService],
})
export class IntegrationsModule {}
