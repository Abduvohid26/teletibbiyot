import { Prisma } from '@prisma/client';

/**
 * Konsilium ishtirokchisi — barcha endpointlar BIR XIL shaklda qaytaradi.
 * Ilgari har ro'yxat o'z `select`iga ega edi va ba'zilarida `joinedAt`/`opinion`
 * yo'q edi: mas'ul shifokor ekranida "ulangan" belgisi va fikrlar ko'rinmasdi.
 */
export const PARTICIPANT_SELECT = {
  id: true,
  doctorId: true,
  joinedAt: true,
  leftAt: true,
  opinion: true,
  opinionAt: true,
  createdAt: true,
  doctor: {
    select: {
      id: true,
      fullName: true,
      specialty: true,
      specialtyRef: { select: { name: true } },
    },
  },
  invitedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ConsultationParticipantSelect;

/** Faol (chiqib ketmagan) ishtirokchilar — `include.participants` uchun */
export const ACTIVE_PARTICIPANTS = {
  where: { leftAt: null },
  select: PARTICIPANT_SELECT,
  orderBy: { createdAt: 'asc' as const },
} satisfies Prisma.Consultation$participantsArgs;
