-- UserRole: UT/MT → to'liq 5 rol modeli
CREATE TYPE "UserRole_new" AS ENUM ('UT_OPERATOR', 'MT_DOCTOR', 'MT_MANAGER', 'ADMIN', 'AUDITOR');

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE "role"::text
      WHEN 'UT' THEN 'UT_OPERATOR'::"UserRole_new"
      WHEN 'MT' THEN 'MT_DOCTOR'::"UserRole_new"
      ELSE 'MT_DOCTOR'::"UserRole_new"
    END
  );

ALTER TABLE "ConsultationMessage"
  ALTER COLUMN "senderRole" TYPE "UserRole_new"
  USING (
    CASE "senderRole"::text
      WHEN 'UT' THEN 'UT_OPERATOR'::"UserRole_new"
      WHEN 'MT' THEN 'MT_DOCTOR'::"UserRole_new"
      ELSE 'MT_DOCTOR'::"UserRole_new"
    END
  );

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
