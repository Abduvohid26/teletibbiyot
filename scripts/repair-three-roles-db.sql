-- Idempotent: 3 ta role migratsiyasini qo'lda yakunlash.
-- Ishlatish: psql -f scripts/repair-three-roles-db.sql

BEGIN;

DO $$
DECLARE
  doctor_id TEXT;
  user_role_udt TEXT;
  msg_role_udt TEXT;
  old_enum_exists BOOLEAN;
  new_enum_exists BOOLEAN;
  old_enum_count INT;
  final_enum_count INT;
BEGIN
  SELECT id INTO doctor_id FROM "User" WHERE email = 'doctor@ishifo.uz' LIMIT 1;
  IF doctor_id IS NULL THEN
    SELECT id INTO doctor_id FROM "User" WHERE role::text = 'MT_DOCTOR' LIMIT 1;
  END IF;
  IF doctor_id IS NULL THEN
    RAISE EXCEPTION 'MT shifokor (doctor@ishifo.uz) topilmadi';
  END IF;

  SELECT udt_name INTO user_role_udt
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'role';

  SELECT udt_name INTO msg_role_udt
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'ConsultationMessage' AND column_name = 'senderRole';

  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') INTO old_enum_exists;
  SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole_new') INTO new_enum_exists;

  IF old_enum_exists THEN
    SELECT COUNT(*) INTO old_enum_count
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole';
  ELSE
    old_enum_count := 0;
  END IF;

  IF old_enum_exists AND old_enum_count <= 3 THEN
    final_enum_count := old_enum_count;
  ELSIF new_enum_exists THEN
    SELECT COUNT(*) INTO final_enum_count
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole_new';
  ELSE
    final_enum_count := 0;
  END IF;

  -- Manager/auditor foydalanuvchilarga bog'liqlikni tozalash
  UPDATE "Consultation"
    SET "mtDoctorId" = doctor_id
    WHERE "mtDoctorId" IN (
      SELECT id FROM "User"
      WHERE role::text IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "FinalDiagnosis"
    SET "mtDoctorId" = doctor_id
    WHERE "mtDoctorId" IN (
      SELECT id FROM "User"
      WHERE role::text IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "SecondOpinion"
    SET "requestedById" = doctor_id
    WHERE "requestedById" IN (
      SELECT id FROM "User"
      WHERE role::text IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "SecondOpinion"
    SET "assignedDoctorId" = doctor_id
    WHERE "assignedDoctorId" IN (
      SELECT id FROM "User"
      WHERE role::text IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "Appointment"
    SET "createdById" = doctor_id
    WHERE "createdById" IN (
      SELECT id FROM "User"
      WHERE role::text IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "Appointment"
    SET "doctorId" = doctor_id
    WHERE "doctorId" IN (
      SELECT id FROM "User"
      WHERE role::text IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  UPDATE "AiAnalysisStep"
    SET "confirmedById" = NULL
    WHERE "confirmedById" IN (
      SELECT id FROM "User"
      WHERE role::text IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  DELETE FROM "ConsultationMessage"
    WHERE "senderId" IN (
      SELECT id FROM "User"
      WHERE role::text IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  DELETE FROM "AiFeedback"
    WHERE "userId" IN (
      SELECT id FROM "User"
      WHERE role::text IN ('MT_MANAGER', 'AUDITOR')
         OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz')
    );

  DELETE FROM "User"
  WHERE role::text IN ('MT_MANAGER', 'AUDITOR')
     OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz');

  IF final_enum_count = 3 AND (
    (old_enum_exists AND old_enum_count <= 3)
    OR (user_role_udt = 'UserRole' AND msg_role_udt = 'UserRole')
  ) THEN
    RAISE NOTICE 'UserRole allaqachon 3 qiymatli — SQL qadamlari o''tkazildi';
    RETURN;
  END IF;

  IF NOT new_enum_exists THEN
    CREATE TYPE "UserRole_new" AS ENUM ('UT_OPERATOR', 'MT_DOCTOR', 'ADMIN');
    new_enum_exists := TRUE;
  END IF;

  IF user_role_udt = 'UserRole' THEN
    ALTER TABLE "User"
      ALTER COLUMN "role" TYPE "UserRole_new"
      USING (
        CASE role::text
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
  END IF;

  IF msg_role_udt = 'UserRole' THEN
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
  END IF;

  IF old_enum_exists THEN
    DROP TYPE "UserRole";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole_new') THEN
    ALTER TYPE "UserRole_new" RENAME TO "UserRole";
  END IF;
END $$;

COMMIT;
