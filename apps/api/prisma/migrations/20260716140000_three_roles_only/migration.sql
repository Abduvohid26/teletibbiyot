-- Faqat 3 ta role: UT_OPERATOR, MT_DOCTOR, ADMIN

-- Oldingi muvaffaqiyatsiz urinishdan qolgan vaqtinchalik enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole_new') THEN
    DROP TYPE "UserRole_new";
  END IF;
END $$;

-- O'chiriladigan foydalanuvchilarga bog'liq yozuvlarni tozalash
DO $$
DECLARE
  doctor_id TEXT;
BEGIN
  SELECT id INTO doctor_id FROM "User" WHERE email = 'doctor@ishifo.uz' LIMIT 1;
  IF doctor_id IS NULL THEN
    SELECT id INTO doctor_id FROM "User" WHERE role = 'MT_DOCTOR' LIMIT 1;
  END IF;
  IF doctor_id IS NULL THEN
    RAISE EXCEPTION 'MT shifokor topilmadi — migratsiyani davom ettirish mumkin emas';
  END IF;

  UPDATE "Consultation"
    SET "mtDoctorId" = doctor_id
    WHERE "mtDoctorId" IN (
      SELECT id FROM "User"
      WHERE role IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "FinalDiagnosis"
    SET "mtDoctorId" = doctor_id
    WHERE "mtDoctorId" IN (
      SELECT id FROM "User"
      WHERE role IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "SecondOpinion"
    SET "requestedById" = doctor_id
    WHERE "requestedById" IN (
      SELECT id FROM "User"
      WHERE role IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "SecondOpinion"
    SET "assignedDoctorId" = doctor_id
    WHERE "assignedDoctorId" IN (
      SELECT id FROM "User"
      WHERE role IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "Appointment"
    SET "createdById" = doctor_id
    WHERE "createdById" IN (
      SELECT id FROM "User"
      WHERE role IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "Appointment"
    SET "doctorId" = doctor_id
    WHERE "doctorId" IN (
      SELECT id FROM "User"
      WHERE role IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "AiAnalysisStep"
    SET "confirmedById" = NULL
    WHERE "confirmedById" IN (
      SELECT id FROM "User"
      WHERE role IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  DELETE FROM "ConsultationMessage"
    WHERE "senderId" IN (
      SELECT id FROM "User"
      WHERE role IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  DELETE FROM "AiFeedback"
    WHERE "userId" IN (
      SELECT id FROM "User"
      WHERE role IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );
END $$;

DELETE FROM "User"
WHERE role IN ('MT_MANAGER', 'AUDITOR')
   OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz');

CREATE TYPE "UserRole_new" AS ENUM ('UT_OPERATOR', 'MT_DOCTOR', 'ADMIN');

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE "role"::text
      WHEN 'UT_OPERATOR' THEN 'UT_OPERATOR'::"UserRole_new"
      WHEN 'MT_DOCTOR' THEN 'MT_DOCTOR'::"UserRole_new"
      WHEN 'ADMIN' THEN 'ADMIN'::"UserRole_new"
      WHEN 'MT_MANAGER' THEN 'MT_DOCTOR'::"UserRole_new"
      WHEN 'AUDITOR' THEN 'ADMIN'::"UserRole_new"
      WHEN 'UT' THEN 'UT_OPERATOR'::"UserRole_new"
      WHEN 'MT' THEN 'MT_DOCTOR'::"UserRole_new"
      WHEN 'TRIAGE_NURSE' THEN 'MT_DOCTOR'::"UserRole_new"
      ELSE 'MT_DOCTOR'::"UserRole_new"
    END
  );

ALTER TABLE "ConsultationMessage"
  ALTER COLUMN "senderRole" TYPE "UserRole_new"
  USING (
    CASE "senderRole"::text
      WHEN 'UT_OPERATOR' THEN 'UT_OPERATOR'::"UserRole_new"
      WHEN 'MT_DOCTOR' THEN 'MT_DOCTOR'::"UserRole_new"
      WHEN 'ADMIN' THEN 'ADMIN'::"UserRole_new"
      WHEN 'MT_MANAGER' THEN 'MT_DOCTOR'::"UserRole_new"
      WHEN 'AUDITOR' THEN 'ADMIN'::"UserRole_new"
      WHEN 'UT' THEN 'UT_OPERATOR'::"UserRole_new"
      WHEN 'MT' THEN 'MT_DOCTOR'::"UserRole_new"
      WHEN 'TRIAGE_NURSE' THEN 'MT_DOCTOR'::"UserRole_new"
      ELSE 'MT_DOCTOR'::"UserRole_new"
    END
  );

DROP TYPE "UserRole";

ALTER TYPE "UserRole_new" RENAME TO "UserRole";
