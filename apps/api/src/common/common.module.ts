import { Global, Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { StartupValidationService } from './startup-validation.service';
import { FieldCryptoService } from './field-crypto.service';

@Global()
@Module({
  providers: [AccessControlService, StartupValidationService, FieldCryptoService],
  exports: [AccessControlService, StartupValidationService, FieldCryptoService],
})
export class CommonModule {}
