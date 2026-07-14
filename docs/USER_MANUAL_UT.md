# UT Operator — iShifo qo'llanmasi

## Kirish
1. Brauzerda tizim manzilini oching (masalan `https://ishifo.uz`)
2. Email va parol bilan kiring
3. Avtomatik **Bemor qabul** (`/ut`) sahifasiga yo'naltirilasiz

## Bemor qabul (5 bosqich)
1. **Shaxsiy ma'lumotlar** — F.I.Sh., tug'ilgan sana, telefon (+998XXXXXXXXX), tuman
2. **Klinik ma'lumotlar** — shikoyatlar, anamnesis morbi/vitae, allergiyalar
3. **Vital ko'rsatkichlar** — puls, qon bosimi, SpO2, harorat
4. **Tekshiruv natijalari** — rentgen/lab fayllarni yuklang (ixtiyoriy)
5. **Yuborish** — bemor roziligini belgilang va **Navbatga yuborish**

## Video konsultatsiya
- Shifokor konsultatsiyani boshlaganda bildirishnoma keladi
- **Vital ko'rsatkichlar** (`/ut/vitals`) sahifasida video aloqaga tayyorlaning
- 4 kamera va mikrofon ishlashini **Qurilmalar** bo'limida tekshiring

## Offline rejim
- Internet uzilsa, ma'lumotlar brauzerda saqlanadi
- Ulanish tiklanganda avtomatik yuboriladi

## DICOM / tasvirlar
- Konsultatsiya ID bilan **DICOM ko'rish** sahifasida fayllarni oching

## Muammo bo'lsa
- Qurilmalar: `/dashboard/devices`
- Incident: admin orqali `POST /api/compliance/incidents`
- Texnik yordam: FJSTI IT bo'limi
