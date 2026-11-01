-- Bildirishnomalar: turi (ovoz/qo'ng'iroq/havola uchun) va qo'shimcha ma'lumot
ALTER TABLE "Notification" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'info';
ALTER TABLE "Notification" ADD COLUMN "data" JSONB;

-- Qo'ng'iroqcha ro'yxati va o'qilmaganlar soni tez ishlashi uchun
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");
