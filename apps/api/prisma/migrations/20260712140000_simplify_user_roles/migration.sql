-- UserRole: 6 ta rol → UT va MT
CREATE TYPE "UserRole_new" AS ENUM ('UT', 'MT');

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE "role"::text
      WHEN 'UT_OPERATOR' THEN 'UT'::"UserRole_new"
      WHEN 'MT_DOCTOR' THEN 'MT'::"UserRole_new"
      WHEN 'MT_MANAGER' THEN 'MT'::"UserRole_new"
      WHEN 'TRIAGE_NURSE' THEN 'MT'::"UserRole_new"
      WHEN 'ADMIN' THEN 'MT'::"UserRole_new"
      WHEN 'AUDITOR' THEN 'MT'::"UserRole_new"
      ELSE 'MT'::"UserRole_new"
    END
  );

ALTER TABLE "ConsultationMessage"
  ALTER COLUMN "senderRole" TYPE "UserRole_new"
  USING (
    CASE "senderRole"::text
      WHEN 'UT_OPERATOR' THEN 'UT'::"UserRole_new"
      WHEN 'MT_DOCTOR' THEN 'MT'::"UserRole_new"
      WHEN 'MT_MANAGER' THEN 'MT'::"UserRole_new"
      WHEN 'TRIAGE_NURSE' THEN 'MT'::"UserRole_new"
      WHEN 'ADMIN' THEN 'MT'::"UserRole_new"
      WHEN 'AUDITOR' THEN 'MT'::"UserRole_new"
      ELSE 'MT'::"UserRole_new"
    END
  );

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
