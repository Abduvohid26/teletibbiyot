-- Shifokorlik yo'nalishlarini kengaytirish.
-- Mavjud 8 ta mutaxassislik (Terapevt..LOR, sortOrder 1-8) o'zgarmaydi — ular
-- allaqachon shifokorlarga biriktirilgan bo'lishi mumkin. Quyidagilar qo'shiladi.
-- ON CONFLICT DO NOTHING: migratsiya qayta ishga tushsa ham dublikat yaratmaydi.

-- "Ginekolog" -> "Akusher-ginekolog": qator O'CHIRILMAYDI, faqat nomi yangilanadi,
-- shuning uchun unga biriktirilgan shifokorlar bog'lanishi saqlanib qoladi.
UPDATE "Specialty"
   SET "name" = 'Akusher-ginekolog', "updatedAt" = CURRENT_TIMESTAMP
 WHERE "name" = 'Ginekolog'
   AND NOT EXISTS (SELECT 1 FROM "Specialty" WHERE "name" = 'Akusher-ginekolog');

INSERT INTO "Specialty" ("id", "name", "sortOrder", "updatedAt") VALUES
  -- Ichki kasalliklar
  (gen_random_uuid()::text, 'Pulmonolog',                        10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Gastroenterolog',                   11, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Endokrinolog',                      12, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Nefrolog',                          13, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Revmatolog',                        14, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Gematolog',                         15, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Allergolog-immunolog',              16, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Infeksionist',                      17, CURRENT_TIMESTAMP),

  -- Yuqori ixtisos
  (gen_random_uuid()::text, 'Onkolog',                           20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Kardioxirurg',                      21, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Angioxirurg',                       22, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Travmatolog-ortoped',               23, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Urolog',                            24, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Proktolog',                         25, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Neyroxirurg',                       26, CURRENT_TIMESTAMP),

  -- Ayollar va bolalar salomatligi
  -- yuqoridagi UPDATE ishlamagan bo'lsa (masalan 'Ginekolog' yo'q edi) — yangi qator
  (gen_random_uuid()::text, 'Akusher-ginekolog',                 30, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Neonatolog',                        31, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Bolalar kardiologi',                32, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Bolalar nevrologi',                 33, CURRENT_TIMESTAMP),

  -- Ruhiy salomatlik
  (gen_random_uuid()::text, 'Psixiatr',                          40, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Psixoterapevt',                     41, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Psixolog',                          42, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Narkolog',                          43, CURRENT_TIMESTAMP),

  -- Boshqa yo'nalishlar
  (gen_random_uuid()::text, 'Dermatovenerolog',                  50, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Stomatolog',                        51, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Ftiziatr',                          52, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Reabilitolog',                      53, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Dietolog',                          54, CURRENT_TIMESTAMP),

  -- Diagnostika (konsilium uchun)
  (gen_random_uuid()::text, 'Radiolog',                          60, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'UZI diagnostikasi shifokori',       61, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Funksional diagnostika shifokori',  62, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Klinik laboratoriya diagnostikasi', 63, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Patomorfolog',                      64, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
