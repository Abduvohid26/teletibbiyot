-- Konsilium: bitta bemorga bir vaqtda bir nechta shifokor ulanishi uchun.
-- Asosiy (mas'ul) shifokor "Consultation"."mtDoctorId" da qoladi;
-- bu jadval unga QO'SHIMCHA maslahatchi shifokorlarni saqlaydi.

CREATE TABLE "ConsultationParticipant" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "invitedById" TEXT,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationParticipant_pkey" PRIMARY KEY ("id")
);

-- Bir shifokor bitta konsultatsiyaga faqat bir marta biriktiriladi
CREATE UNIQUE INDEX "ConsultationParticipant_consultationId_doctorId_key"
  ON "ConsultationParticipant"("consultationId", "doctorId");

CREATE INDEX "ConsultationParticipant_doctorId_idx" ON "ConsultationParticipant"("doctorId");
CREATE INDEX "ConsultationParticipant_consultationId_idx" ON "ConsultationParticipant"("consultationId");

ALTER TABLE "ConsultationParticipant"
  ADD CONSTRAINT "ConsultationParticipant_consultationId_fkey"
  FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsultationParticipant"
  ADD CONSTRAINT "ConsultationParticipant_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsultationParticipant"
  ADD CONSTRAINT "ConsultationParticipant_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
