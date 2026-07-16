-- Faqat 3 ta role: UT_OPERATOR, MT_DOCTOR, ADMIN
DELETE FROM "User" WHERE role IN ('MT_MANAGER', 'AUDITOR')
   OR email IN ('manager@ishifo.uz', 'auditor@ishifo.uz');

CREATE TYPE "UserRole_new" AS ENUM ('UT_OPERATOR', 'MT_DOCTOR', 'ADMIN');

ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");

DROP TYPE "UserRole";

ALTER TYPE "UserRole_new" RENAME TO "UserRole";
