# iShifo — Pilot va Production Tayyorgarlik

Bu hujjat iShifo platformasini real klinik pilotda ishlatish uchun zarur qadamlarni tavsiflaydi.

## 1. Production muhit sozlash

```bash
cp .env.example .env
# Barcha CHANGE_ME qiymatlarni almashtiring
docker compose --profile prod up -d --build
# migrate + bootstrap avtomatik (ADMIN_BOOTSTRAP_* kerak)
```

**ENCRYPTION_KEY yoqilganda** mavjud DB uchun bir martalik:
```bash
cd apps/api && ENCRYPTION_KEY=... DATABASE_URL=... npx ts-node prisma/encrypt-existing-patients.ts
```

### Majburiy o'zgaruvchilar (production)

| O'zgaruvchi | Tavsif |
|-------------|--------|
| `JWT_SECRET` | Kamida 32 belgi, tasodifiy |
| `POSTGRES_PASSWORD` | Kuchli parol |
| `REDIS_PASSWORD` | Kuchli parol |
| `OPENAI_API_KEY` | AI tahlil uchun (mock o'chirilgan) |
| `TURN_PUBLIC_URL` / `TURN_PASSWORD` | Rural NAT uchun WebRTC (brauzer ulanadigan manzil) |
| `METRICS_BEARER_TOKEN` | Prometheus `/api/metrics` himoyasi |
| `ENCRYPTION_KEY` | PINFL/telefon shifrlash (kamida 32 belgi) |
| `S3_*` | Fayl saqlash (MinIO yoki AWS S3) |
| `CORS_ORIGINS` | Production domen(lar) |

### Tavsiya etiladi

| O'zgaruvchi | Tavsif |
|-------------|--------|
| `SMTP_*` | Email bildirishnomalar |
| `SMS_PROVIDER=eskiz` | Favqulodda SMS |
| `ESKIZ_EMAIL` / `ESKIZ_PASSWORD` | Eskiz.uz hisobi |
| `DATA_RETENTION_DAYS` | Default: 2555 (7 yil) |
| `RETENTION_CRON_ENABLED=true` | Avtomatik retention |
| `DEVICE_MODE=real` | Haqiqiy qurilmalar ulanganda |

## 2. Monitoring

- **Health:** `GET /api/health`, `/api/health/ready`, `/api/health/live`
- **Prometheus:** `GET /api/metrics`
- **Startup tekshiruv:** `GET /api/health/startup-checks` (ADMIN)
- **Video/TURN:** `GET /api/health/video-check` (klinik admin)

Monitoring stack:

```bash
docker compose --profile monitoring up -d
# METRICS_BEARER_TOKEN .env da API bilan bir xil bo'lishi kerak
```

Grafana: http://localhost:3002 (admin/admin — parolni o'zgartiring)

## 3. Backup va tiklash

```bash
# Linux/macOS
./scripts/backup/postgres.sh

# Windows
./scripts/backup/postgres.ps1

# Backup tekshiruv
./scripts/backup/verify-backup.sh ./backups/postgres/ishifo_YYYYMMDD_HHMMSS.sql.gz
```

Cron (Linux): `0 2 * * * /path/to/scripts/backup/postgres.sh`

## 4. Xavfsizlik

- Audit log **o'zgartirilmaydi** (Prisma middleware)
- Productionda `ALLOW_SEED=false`
- Productionda AI mock **o'chirilgan**
- Bemor roziligi (`consentGiven`) konsultatsiya yaratishda majburiy
- Incident reporting: `POST /api/compliance/incidents`
- Ma'lumot eksporti (GDPR): `GET /api/compliance/export/patient/:id` (ADMIN)

## 5. Bildirishnomalar

1. SMTP sozlang — navbat/email ogohlantirishlar
2. Eskiz SMS — favqulodda triage uchun
3. Shifokor profilida `phone` to'ldiring — SMS yuborish uchun

## 6. Pilot protokoli (tavsiya)

### Oldin
- [ ] SSL sertifikat (Let's Encrypt yoki davlat CA)
- [ ] TURN server rural UT da sinovdan o'tkazilgan
- [ ] Backup + restore testi o'tkazilgan
- [ ] 20+ E2E test CI da yashil
- [ ] Xodimlar uchun qo'llanma tayyorlangan
- [ ] Incident response rejasi tasdiqlangan

### Pilot davri (2-4 hafta)
- [ ] Kunlik backup monitoring
- [ ] Konsultatsiya vaqti, video sifati kuzatuvi
- [ ] AI xatoliklari va shifokor feedback yig'ish
- [ ] Audit log haftalik ko'rib chiqish

### Keyin
- [ ] OneID/ERI integratsiyasi (rasmiy identifikatsiya)
- [ ] DICOM viewer
- [ ] Elektron retsept (Davlat tizimi)
- [ ] ISO/IEEE 11073 qurilma gateway

## 7. Test hisoblar (faqat development/staging)

| Rol | Email | Parol |
|-----|-------|-------|
| UT operator | operator@ishifo.uz | password123 |
| MT shifokor | doctor@ishifo.uz | password123 |
| MT menejer | manager@ishifo.uz | password123 |
| Admin | admin@ishifo.uz | password123 |
| Auditor | auditor@ishifo.uz | password123 |

Productionda seed **ishlatmang** (`ALLOW_SEED=false`).

## 8. API yangi endpointlar

| Endpoint | Rol | Maqsad |
|----------|-----|--------|
| `GET /api/metrics` | Public | Prometheus |
| `GET /api/compliance/retention/status` | ADMIN, AUDITOR | Retention holati |
| `POST /api/compliance/retention/run` | ADMIN | Qo'lda retention |
| `GET /api/compliance/consent-audit` | ADMIN, AUDITOR | Rozilik audit |
| `POST /api/compliance/incidents` | Klinik xodimlar | Incident hisobot |
| `GET /api/devices/mode` | Klinik | Simulyator/real rejim |

## 9. Qonuniy talablar (jarayon)

Quyidagilar kod emas, tashkiliy talablar:

- Bemor ma'lumotlari maxfiyligi siyosati
- AI maslahatlari uchun mas'uliyat cheklovi (disclaimer UI da mavjud)
- Tibbiy ma'lumotlarni saqlash muddatlari (O'zbekiston qonunchiligi)
- Shifokor litsenziyasi va masofaviy konsultatsiya ruxsati

---

**Versiya:** 1.2.0-pilot | **Sana:** 2026-07-12
