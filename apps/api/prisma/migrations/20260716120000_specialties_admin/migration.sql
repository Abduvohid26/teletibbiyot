-- CreateTable
CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Specialty_name_key" ON "Specialty"("name");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "specialtyId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default specialties
INSERT INTO "Specialty" ("id", "name", "sortOrder", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Terapevt', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Kardiolog', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Nevrolog', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Pediatr', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Xirurg', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Ginekolog', 6, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Oftalmolog', 7, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'LOR', 8, CURRENT_TIMESTAMP);
