-- CreateEnum
CREATE TYPE "SecondOpinionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED');
CREATE TYPE "EscalationLevel" AS ENUM ('NONE', 'SENIOR_REVIEW', 'EMERGENCY');
CREATE TYPE "RecordingStatus" AS ENUM ('PENDING', 'RECORDING', 'COMPLETED', 'FAILED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TRIAGE_NURSE';

-- AlterTable Consultation
ALTER TABLE "Consultation" ADD COLUMN IF NOT EXISTS "escalationLevel" "EscalationLevel" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Consultation" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);
ALTER TABLE "Consultation" ADD COLUMN IF NOT EXISTS "checklistCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Consultation" ADD COLUMN IF NOT EXISTS "checklistData" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Consultation" ADD COLUMN IF NOT EXISTS "consentGiven" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Consultation" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

-- AlterTable AiAnalysisStep
ALTER TABLE "AiAnalysisStep" ADD COLUMN IF NOT EXISTS "doctorConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiAnalysisStep" ADD COLUMN IF NOT EXISTS "confirmedById" TEXT;
ALTER TABLE "AiAnalysisStep" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "AiAnalysisStep" ADD COLUMN IF NOT EXISTS "doctorNotes" TEXT;

-- AlterTable SessionRecording
ALTER TABLE "SessionRecording" ADD COLUMN IF NOT EXISTS "status" "RecordingStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "SessionRecording" ADD COLUMN IF NOT EXISTS "fileKey" TEXT;
ALTER TABLE "SessionRecording" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
ALTER TABLE "SessionRecording" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "SessionRecording" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);

-- AlterTable DeviceStatus
ALTER TABLE "DeviceStatus" ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;
ALTER TABLE "DeviceStatus" ADD COLUMN IF NOT EXISTS "lastTelemetryAt" TIMESTAMP(3);

-- CreateTable ConsultationReport
CREATE TABLE IF NOT EXISTS "ConsultationReport" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    CONSTRAINT "ConsultationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable SecondOpinion
CREATE TABLE IF NOT EXISTS "SecondOpinion" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "assignedDoctorId" TEXT,
    "status" "SecondOpinionStatus" NOT NULL DEFAULT 'PENDING',
    "question" TEXT NOT NULL,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "SecondOpinion_pkey" PRIMARY KEY ("id")
);

-- CreateTable Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "consultationId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable DeviceTelemetry
CREATE TABLE IF NOT EXISTS "DeviceTelemetry" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "raw" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceTelemetry_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Consultation_clientRequestId_key" ON "Consultation"("clientRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "ConsultationReport_consultationId_key" ON "ConsultationReport"("consultationId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "AiAnalysisStep" ADD CONSTRAINT "AiAnalysisStep_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ConsultationReport" ADD CONSTRAINT "ConsultationReport_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SecondOpinion" ADD CONSTRAINT "SecondOpinion_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SecondOpinion" ADD CONSTRAINT "SecondOpinion_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SecondOpinion" ADD CONSTRAINT "SecondOpinion_assignedDoctorId_fkey" FOREIGN KEY ("assignedDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeviceTelemetry" ADD CONSTRAINT "DeviceTelemetry_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DeviceStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeviceStatus" ADD CONSTRAINT "DeviceStatus_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
