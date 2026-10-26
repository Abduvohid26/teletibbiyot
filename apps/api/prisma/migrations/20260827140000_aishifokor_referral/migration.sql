-- AiShifokor teletibbiyot yo'naltirishlari
CREATE TABLE "AishifokorReferral" (
    "id" TEXT NOT NULL,
    "handoffToken" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "aishifokorReferralId" INTEGER,
    "aishifokorAnalysisId" INTEGER,
    "reason" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'routine',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "consultationId" TEXT,
    "callbackSentAt" TIMESTAMP(3),
    "callbackError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AishifokorReferral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AishifokorReferral_handoffToken_key" ON "AishifokorReferral"("handoffToken");
CREATE UNIQUE INDEX "AishifokorReferral_correlationId_key" ON "AishifokorReferral"("correlationId");
CREATE UNIQUE INDEX "AishifokorReferral_consultationId_key" ON "AishifokorReferral"("consultationId");

ALTER TABLE "AishifokorReferral" ADD CONSTRAINT "AishifokorReferral_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
