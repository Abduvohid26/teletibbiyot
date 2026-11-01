-- Konsilium: maslahatchi shifokor fikri
ALTER TABLE "ConsultationParticipant" ADD COLUMN "opinion" TEXT;
ALTER TABLE "ConsultationParticipant" ADD COLUMN "opinionAt" TIMESTAMP(3);
