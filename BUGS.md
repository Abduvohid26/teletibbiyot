# 🐛 Teletibbiyot — Aniqlangan Buglar Ro'yxati

> `git diff HEAD` (commit qilinmagan o'zgarishlar) ustidan 7 ta mustaqil
> kod-tekshiruv agenti topgan va qo'lda tasdiqlangan buglar, + sizning
> qarorlaringiz asosida amalga oshirilgan qo'shimcha ishlar.
>
> **Holat:** ✅ 21 ta tuzatildi · ⏸️ 1 ta ma'lumot kutmoqda (video, deployment holatiga bog'liq) · 📋 2 ta keyinga qoldirildi (past ustuvorlik, kosmetik).
> Har bir tuzatishdan keyin `apps/api` va `apps/web` `tsc --noEmit` toza o'tdi.

---

## 🔴 KRITIK — Tibbiy ma'lumot yaxlitligi / xavfsizlik

### [x] 1. Avto-yakunlanish + PDF bemor kartasida ko'rinishi ✅
- **Qaror:** Avto-yakunlanish saqlanadi (doctor-confirmation qopqog'i qaytarilmaydi),
  lekin bemorga Konsilium PDF **avtomatik biriktirilishi va bemorlar ro'yxatida/
  kartasida ko'rinishi** kerak edi.
- **Fayl:** `apps/api/src/patients/patients.service.ts:167` — `findOne` endi har
  konsultatsiya uchun `consultationReport { id, fileName, generatedAt }` ni ham qaytaradi.
- **Fayl:** `apps/web/src/components/analytics/PatientDetailPanel.tsx` — bemor
  kartasida har konsultatsiya bo'limida, report mavjud bo'lsa, **"Konsilium PDF"**
  tugmasi chiqadi (`handleOpenReport` → `api.getReportLink` → yangi tabda ochadi).
- **Eslatma:** `complete()` allaqachon `persistAnalysisReport`ni chaqiradi, ya'ni
  yakunlashda PDF avtomatik generatsiya qilinib saqlanadi — endi u bemor kartasida
  ham ko'rinadi.

### [x] 2. Bo'sh AI tashxisida "R69" / "Klinik xulosa" soxta placeholder yoziladi ✅
- **Fayl:** `apps/api/src/consultations/consultations.service.ts:855-868`
- **Tuzatildi:** `buildFinalDiagnosisFromAi` endi haqiqiy tashxis bo'lmasa `null`
  qaytaradi (placeholder o'rniga), shunda `resolveFinalDiagnosis` guardi ishga tushib,
  "AI klinik xulosa topilmadi" xatosini beradi. Bemorga soxta "R69" yozilmaydi.

### [x] 3. PDF footer/disclaimer faqat oxirgi sahifada chiqadi, "Sahifa 1/1" xato ✅
- **Fayl:** `apps/api/src/ai/clinical-conclusion-pdf.ts:115`
- **Tuzatildi:** `new PDFDocument({ margin: 50, size: 'A4', bufferPages: true })`.
  Endi footer/brend/disclaimer barcha sahifalarda chiqadi va "Sahifa X/Y" to'g'ri.

### [x] 4. AI-disclaimer banneri shifokor ekranidan olib tashlangan ✅
- **Fayl:** `apps/web/src/components/dashboard/ClinicalConclusionReport.tsx:50`
- **Tuzatildi:** "Bu AI konsensus xulosasi..." ogohlantirish banneri header'dan keyin
  qaytarildi (endi `expanded` holatda ham ko'rinadi).

### [x] 5. Audit log doim `source: 'ai'` deb yozadi, qo'lda kiritilgan tashxisda ham ✅
- **Fayl:** `apps/api/src/consultations/consultations.service.ts:454,469`
- **Tuzatildi:** `source` endi haqiqatga qarab: `dto.diagnosis` bo'lsa `'manual'`,
  aks holda `'ai'`.

### [x] 6. Ikki xil yosh-hisoblash algoritmi — natija bir kunga farq qilishi mumkin ✅
- **Fayl:** `apps/api/src/ai/ai.service.ts` — `calculateAge()` helperi
- **Tuzatildi:** Bitta kalendarga asoslangan `calculateAge(birthDate)` helperi
  ajratildi va uch joyda (`analyzeConsultation`, PDF, chat konteksti) ishlatildi.

---

## 🟠 O'RTA — Yashirin xatolar / xulq-atvor

### [x] 2 (2-bosqich). AI ICD-10 kodini tushirsa ham yakunlash bloklanmasin ✅
- **Qaror:** Avto-yakunlanish AI **tashxis nomiga** asoslanishi kerak — kod (ICD-10)
  ikkinchi darajali.
- **Fayl:** `apps/api/src/consultations/consultations.service.ts:858-868`
  (`buildFinalDiagnosisFromAi`)
- **Tuzatildi:** Endi faqat AI tashxis **nomi umuman yo'q** bo'lsa `null` qaytariladi
  (yakunlash bloklanadi — "AI klinik xulosa topilmadi"). Agar nom bor-u, faqat
  ICD-10 kodi tushib qolgan bo'lsa, `'R69'` (aniqlanmagan) qo'yiladi va yakunlash
  davom etadi. Bemorga soxta "Klinik xulosa" matni endi yozilmaydi — faqat kod
  yetishmasa shunday bo'ladi.

### [x] 7. `compact` → `dense` migratsiyasi to'liq emas (yashirin xato) ✅
- **Fayl:** `apps/web/src/components/dashboard/ClinicalConclusionReport.tsx`
- **Tuzatildi:** Asosiy komponent tanasidagi barcha 22 ta `compact ?` → `dense ?`
  ga o'tkazildi. `Section` sub-komponenti o'z `compact` propini saqlaydi.

### [x] 8. Soxta, tashxisga aloqasiz "to'ldiruvchi" klinik kontent olib tashlandi ✅
- **Qaror:** Soxta kontent kerak emas — hammasi AI tahlili asosida generatsiya
  qilinishi kerak.
- **Fayl:** `apps/web/src/lib/clinical-conclusion.ts` (`enrichFromLegacy`,
  `defaultScientificArticles` funksiyasi butunlay o'chirildi)
- **Tuzatildi:** Qattiq kodlangan WHO parhez ro'yxati, "Matricaria chamomilla"
  (romashka) o'simlik dorisi, profilaktika maslahatlari, prognoz shabloni matni,
  sifat bali, bemor marshrutlash va soxta ilmiy maqolalar **butunlay olib
  tashlandi**. Endi faqat AI tahlilidan haqiqatan kelgan ma'lumot (`treatmentSteps`,
  `riskFactors`, tavsiyalardan ajratilgan `additionalTests`/`followUp`) ko'rsatiladi.
  Bo'lim uchun AI ma'lumot bermasa — UI o'sha bo'limni shunchaki yashiradi
  (soxta matn ko'rsatmaydi).

---

## 🟡 UNUMDORLIK

### [x] 9. `getClinicalConclusion` har render'da (har klavish bosishida) qayta hisoblanadi ✅
- **Fayl:** `apps/web/src/components/dashboard/ClinicalConclusionReport.tsx:29`
- **Tuzatildi:** `useMemo(() => getClinicalConclusion(analysis), [analysis])`.

### [x] 10 va 11. Fayl proksisi — streaming bilan optimallashtirildi ✅
- **Qaror:** "Yaxshi variantni tanlash kerak" — tahlil: tibbiy ilova uchun proksi
  yondashuvni **saqlab qolish to'g'ri**, chunki har fayl ochilishi autentifikatsiya
  qilinadi **va audit logga yoziladi** (`getAttachmentForAccess`). Presigned-URL'ga
  o'tish bu auditni chetlab o'tadi va vaqtinchalik ochiq havola qoldiradi — tibbiy
  maxfiylik nuqtai nazaridan yomonroq. Shuning uchun **proksi saqlanadi, lekin
  xotira sarfi muammosi (#10) tuzatiladi** — bu ikkalasini ham yopadi.
- **Fayl:** `apps/api/src/storage/storage.service.ts:130-143` — yangi
  `getObjectStream(key)` metodi qo'shildi (statObject bilan content-type/size,
  keyin `getObject` orqali oqim qaytaradi, butun faylni xotiraga yuklamaydi).
- **Fayl:** `apps/api/src/attachments/attachments.service.ts:132-142` (`streamFile`)
  — endi `buffer` o'rniga `stream` qaytaradi.
- **Fayl:** `apps/api/src/attachments/attachments.controller.ts:78-102` (`file`)
  — `res.send(buffer)` o'rniga `stream.pipe(res)`, xato handling bilan
  (`stream.on('error', ...)`), `Content-Length` header qo'shildi.
- **Eslatma:** `storage.service.ts` dagi eski `getObjectBuffer` olib tashlanmadi —
  u boshqa joyda (`attachment-analysis.service.ts`, AI'ga rasm yuborish uchun)
  hali kerak, u yerda butun buferni AI API'ga yuborish tabiiy.

---

## 🔵 TOZALASH

### [x] 12. Blob-yuklab-olish logikasi 3-4 marta takrorlangan ✅
- **Tuzatildi:** Yangi `apps/web/src/lib/download.ts` (`downloadBlob`, `triggerDownload`)
  helperi yaratildi va `AttachmentManager` hamda `AttachmentViewer` da ishlatildi.

### [x] 13. `enrichFromLegacy` da ~12 ta takroriy fallback bloki ✅ (o'z-o'zidan hal bo'ldi)
- **Fayl:** `apps/web/src/lib/clinical-conclusion.ts`
- **Eslatma:** №8 tuzatilganda (soxta filler bloklari butunlay o'chirilganda) bu
  muammo ham avtomatik yo'qoldi — endi funksiyada atigi 4 ta qisqa, AI ma'lumotidan
  olingan fallback qoldi (takrorlanish yo'q).

### [x] 14. Bir xil inline tip ikki metodda takrorlangan ✅
- **Fayl:** `apps/api/src/consultations/consultations.service.ts:44`
- **Tuzatildi:** `type AiAnalysisForCompletion` e'lon qilinib ikki joyda ishlatildi.

### [x] 15. `AttachmentViewer` da ortiqcha revoke effekti (use-after-revoke xavfi) ✅
- **Fayl:** `apps/web/src/components/attachments/AttachmentViewer.tsx`
- **Tuzatildi:** Ikkinchi ortiqcha `useEffect` olib tashlandi; revoke faqat fetch
  effektining cleanup'ida qoldi.

### [x] 16. `handleComplete` da retry bloki copy-paste ✅
- **Fayl:** `apps/web/src/components/dashboard/DoctorDashboardView.tsx:73-84`
- **Tuzatildi:** Ikki nusxa o'rniga bitta `for` sikl (2 urinish, 2s kutish).

### 📋 17. `genderLabel` backendda takrorlangan — KEYINGA (past qiymat)
- **Fayl:** `apps/api/src/ai/clinical-conclusion-pdf.ts:79-84`
- **Nega keyinga:** Backend web `utils.ts` ni oson import qila olmaydi (alohida
  paketlar). `@ishifo/shared` ga ko'chirish kerak — past ustuvorlik.

### 📋 18. `fetchAttachmentFile` filename-parsing'ni qayta yozadi — KEYINGA (past qiymat)
- **Fayl:** `apps/web/src/lib/api/media.ts:30-46`
- **Nega keyinga:** `integrations.ts` dagi bilan birxillashtirish kerak, lekin ikki
  regex biroz farq qiladi. Past ustuvorlik.

### [x] 19. `callOpenAiChat` da ishlatilmaydigan `'system'` role tarmog'i ✅
- **Fayl:** `apps/api/src/ai/ai.service.ts:236-247`
- **Tuzatildi:** `'system'` role tip ittifoqidan olib tashlandi; system-prompt endi
  doim `options.systemPrompt` orqali qo'shiladi (yagona mexanizm).

### [x] 20. O'lik "Hisobot yaratish" quick-action tugmasi ✅
- **Fayl:** `apps/web/src/components/dashboard/BottomPanels.tsx:293`
- **Tuzatildi:** `create-report` tugmasi `QUICK_ACTIONS` dan olib tashlandi.

---

## 🆕 QO'SHIMCHA (tuzatish jarayonida topilgan)

### [x] 21. Loyiha `npm run build` bilan kompilyatsiya bo'lmaydi (oldindan mavjud) ✅
- **Fayl:** `apps/api/src/ai/ai.service.ts:412-438` (`buildAnalysisPdfBufferForConsultation`)
- **Muammo:** Chaqiruvchilar `aiAnalysis` null emasligini tekshiradi, lekin butun
  obyektni uzatgani uchun TypeScript ichki xususiyatni toraytirmaydi → 2 ta
  build-buzuvchi type xato. Bu sizning working tree'ingizda **oldindan bor edi** —
  ya'ni loyiha commit qilishdan oldin ham kompilyatsiya bo'lmasdi.
- **Tuzatildi:** Parametr tipida `aiAnalysis` nullable qilindi + funksiya ichida
  guard qo'shildi. Endi API toza kompilyatsiya bo'ladi.

---

## Xulosa

**Tuzatildi (18):** №1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21

**Keyinga qoldirildi — past ustuvorlik, kosmetik (2):**
- №17 — `genderLabel` backend/frontend'da takrorlangan (umumiy `@ishifo/shared` ga
  ko'chirish kerak, hozircha ikkalasi ham to'g'ri ishlaydi)
- №18 — `fetchAttachmentFile` filename-parsing regexi `integrations.ts` dagidan
  biroz farq qiladi (ikkalasi ham ishlaydi, lekin birxillashtirish kerak)

**Barcha qarorlar amalga oshirildi:**
- **№1** — Avto-yakunlanish saqlandi + PDF bemor kartasida "Konsilium PDF" tugmasi
  bilan ko'rinadi
- **№2** — AI faqat ICD-10 kodini tushirsa ham (nom bo'lsa) yakunlash bloklanmaydi
- **№8** — Soxta filler kontent (parhez, romashka, prognoz shabloni va h.k.)
  butunlay olib tashlandi, faqat AI'dan kelgan ma'lumot ko'rsatiladi
- **№11** — Fayl proksisi saqlandi (audit/xavfsizlik uchun), lekin streaming bilan
  optimallashtirildi (xotiraga to'liq yuklamaydi)

Ikkala loyiha ham (`apps/api`, `apps/web`) `tsc --noEmit` toza o'tadi.

---

## 🎥 UT-OPERATOR ↔ SHIFOKOR VIDEO-ULANISH TEKSHIRUVI (yangi)

> UT operator (qishloqdagi bemor bilan) va MT shifokor (masofadagi mutaxassis)
> o'rtasidagi video-konsultatsiya signalizatsiyasini (`video.gateway.ts`,
> `use-video-room.ts`, `video-socket-client.ts`) tekshirib chiqdim.

### [x] 22. Qayta-ulanish (reconnect) yugurish holati — kamera resurs sizib chiqishi ✅
- **Fayl:** `apps/web/src/hooks/use-video-room.ts` (`reconnectCall`)
- **Muammo:** `reconnectCall()` da qayta kirishni to'sadigan qopqoq yo'q edi.
  Avtomatik trigger (`reconnectSignal`) va "Qayta ulash" tugmasi bir vaqtda
  ishga tushsa, ikkala chaqiruv ham `getUserMedia` ni parallel so'raydi va
  birinchisining oqimi to'xtatilmasdan qoladi (kamera "band" bo'lib qoladi).
- **Tuzatildi:** `isReconnectingRef` bilan re-entrancy qopqog'i qo'shildi —
  funksiya ishlab turganda qayta chaqiruvlar e'tiborsiz qoldiriladi.

### [x] 23. Offer/answer muzokarasi "thrash" qilishi (beqaror aloqada hech qachon ulanmaydi) ✅
- **Fayl:** `apps/web/src/hooks/use-video-room.ts` (`makeOffer`)
- **Muammo:** Har safar `media-resumed`/`offer-requested`/`participant-rejoined`
  hodisasi kelganda (beqaror internetda tez-tez sodir bo'ladi),
  `scheduleOfferToPeer` → `makeOffer` peer-connection'ni **allaqachon sog'lom
  (connected/connecting) bo'lsa ham** buzib, qaytadan quradi. Natijada
  ulanish hech qachon "connected" holatiga barqaror kelmaydi — doim
  "connecting" bilan "closed" orasida tebranadi.
- **Tuzatildi:** `makeOffer` endi mavjud peer-connection holatini tekshiradi;
  `connected`/`connecting` bo'lsa qayta boshlamaydi (mavjud `onconnectionstatechange`
  dagi `failed` → `restartIce()` mexanizmiga ishonch bildiradi).

### [x] 24. Staff-feed xonasidan chiqishda noto'g'ri xona nomi — obuna "sizib chiqishi" ✅
- **Fayl:** `apps/web/src/lib/video-socket-client.ts` (`leaveRoom`, `joinStaffFeed`)
- **Muammo:** Server `join-staff-feed` da haqiqiy xonalarga qo'shadi
  (`staff-feed:ut:<facilityId>` yoki `staff-feed:mt:queue` +
  `staff-feed:mt:doctor:<id>`), lekin client `leaveRoom` chaqirilganda literal
  `"staff-feed"` nomli (hech qachon qo'shilmagan) xonadan chiqishga urinadi —
  bu server tomonda no-op. Natijada foydalanuvchi sahifadan chiqib ketgandan
  keyin ham navbat/konsultatsiya hodisalarini olishda davom etadi (boshqa
  bemorlar/konsultatsiyalar ma'lumoti sizib chiqishi mumkin).
- **Tuzatildi:** Server qaytargan haqiqiy xona nomlari (`ack.rooms`) endi
  saqlanadi va `leaveRoom` aynan o'sha nomlar bilan chiqadi.

### ⏸️ 25. Ko'p-instansiyali (Redis) deploymentda signalizatsiya butunlay ishlamasligi — QAROR/MA'LUMOT KERAK
- **Fayl:** `apps/api/src/video/video.gateway.ts:66-69` (`private rooms = new Map(...)`),
  `551-562` (`isInRoom`/`isTargetInRoom`), `205-221` (`handleJoinRoom`)
- **Muammo:** Xona ishtirokchilari holati **faqat jarayon xotirasidagi**
  (`this.rooms`) Map'da saqlanadi — bu Redis Socket.IO adapteri bilan
  **sinxronlanmaydi**. `docker-compose.yml` production'da `REDIS_URL` ni
  majburiy qilib qo'ygan (`main.ts:35-37` — ulanolmasa `process.exit(1)`),
  bu ko'p-instansiyali (yoki rolling-restart paytida vaqtincha ikki
  instansiyali) joylashtirish ko'zda tutilganini bildiradi.
- **Nima buziladi:** Agar UT operator va shifokor turli API instansiyalariga
  ulansa: (a) `isTargetInRoom` signal (offer/answer/ICE) ni "qabul qiluvchi
  xonada emas" deb rad etadi; (b) shifokorning `room-participants` ro'yxati
  bo'sh keladi, shuning uchun u (har doim "offerer" bo'lgani uchun)
  `makeOffer` ni HECH QACHON chaqirmaydi. **Natija: video qo'ng'iroq umuman
  boshlanmaydi**, lekin chat/vitals kabi keng-translyatsiya xususiyatlari
  ishlayveradi (chunki ular to'g'ridan-to'g'ri Socket.IO'ning o'z
  `server.to(roomId)` mexanizmidan foydalanadi, mahalliy Map'dan emas) —
  shuning uchun bu "video ulanmaydi, lekin boshqa hammasi ishlaydi" kabi
  chalkash simptom beradi.
- **Nega tuzatilmadi:** Bu **arxitektura darajasidagi** tuzatish — bir nechta
  handler'ni (`handleOffer`, `handleAnswer`, `handleIceCandidate`,
  `handleJoinRoom`) `fetchSockets()` asosidagi instansiyalararo tekshiruvga
  o'tkazish, va ishtirokchi metadatasini (`role`, `userName`) `client.data`ga
  ko'chirish kerak. Buni jonli ko'p-instansiyali muhitda sinamasdan qilish
  xavfli — ishlayotgan signalizatsiyani buzib qo'yish xavfi bor.
- **Sizga savol:** Production'da **necha API instansiya** ishlaydi (bitta
  konteynermi yoki gorizontal masshtablanadimi)? Agar bitta instansiya bo'lsa,
  bu bug hozircha **uxlab yotibdi** (real ta'siri yo'q) va ustuvorlik past.
  Agar 2+ instansiya (yoki rolling-deploy) bo'lsa, bu **eng ehtimoliy sabab**
  nima uchun ba'zi UT-shifokor ulanishlari "osilib qoladi" — shunday bo'lsa,
  keyingi bosqichda `fetchSockets()` asosida to'g'irlab, staging'da sinab
  ko'ramiz.

### 📋 26. O'lik consent-xato tekshiruvi — past ustuvorlik
- **Fayl:** `apps/web/src/hooks/use-session-recording.ts:104-112`
- **Muammo:** `catch` blokida `msg.includes('rozilik')` tekshiruvi bor, lekin
  yozuvni boshlash yo'lida (`tryStartRecording`) rozilik yo'qligi hech qachon
  `throw` qilmaydi (u allaqachon `null` qaytarib, yuqorida silliq boshqariladi).
  Shu sabab bu shart amalda hech qachon ishga tushmaydi — zararsiz, lekin
  chalg'ituvchi o'lik kod.
- **Nega tuzatilmadi:** Runtime ta'siri yo'q; consent-bog'liq xato boshqarish
  kodini "tozalash" nomi bilan tegib o'zgartirish xavfini past ustuvorlikda
  qoldirdim.
