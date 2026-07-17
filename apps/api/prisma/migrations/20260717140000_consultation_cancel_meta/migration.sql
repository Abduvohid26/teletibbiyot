-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Consultation" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Consultation" ADD COLUMN "cancelledById" TEXT;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
