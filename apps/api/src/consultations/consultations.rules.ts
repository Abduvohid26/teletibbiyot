import { BadRequestException } from '@nestjs/common';
import { ConsultationStatus } from '@prisma/client';

/**
 * Minimal unit checks for consultation start rules (extracted logic).
 */
export function assertCanStartWhileAnotherActive(
  otherActive: { id: string; patient: { fullName: string } } | null,
) {
  if (otherActive) {
    throw new BadRequestException(
      `Avval "${otherActive.patient.fullName}" konsultatsiyasini yakunlang yoki paneldan tanlang`,
    );
  }
}

export function isJoinableConsultationStatus(status: ConsultationStatus) {
  return status === ConsultationStatus.QUEUED || status === ConsultationStatus.IN_PROGRESS;
}
