import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { AishifokorController } from './aishifokor.controller';
import { OneIdService } from './oneid.service';
import { PrescriptionService } from './prescription.service';
import { DicomService } from './dicom.service';
import { AishifokorService } from './aishifokor.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [IntegrationsController, AishifokorController],
  providers: [OneIdService, PrescriptionService, DicomService, AishifokorService],
  exports: [OneIdService, PrescriptionService, DicomService, AishifokorService],
})
export class IntegrationsModule {}
