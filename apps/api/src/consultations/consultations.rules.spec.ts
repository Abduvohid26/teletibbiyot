import { BadRequestException } from '@nestjs/common';
import {
  assertCanStartWhileAnotherActive,
  isJoinableConsultationStatus,
} from './consultations.rules';
import { ConsultationStatus } from '@prisma/client';

describe('consultations.rules', () => {
  it('blocks starting when doctor already has active consultation', () => {
    expect(() =>
      assertCanStartWhileAnotherActive({
        id: 'c1',
        patient: { fullName: 'Karimova Dilnoza' },
      }),
    ).toThrow(BadRequestException);
  });

  it('allows start when no other active consultation', () => {
    expect(() => assertCanStartWhileAnotherActive(null)).not.toThrow();
  });

  it('allows video join for queued and in-progress', () => {
    expect(isJoinableConsultationStatus(ConsultationStatus.QUEUED)).toBe(true);
    expect(isJoinableConsultationStatus(ConsultationStatus.IN_PROGRESS)).toBe(true);
    expect(isJoinableConsultationStatus(ConsultationStatus.COMPLETED)).toBe(false);
  });
});
