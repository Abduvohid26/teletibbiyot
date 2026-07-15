# Ishifo — Production Deploy Qo'llanmasi

## Talablar

- Docker 24+ va Docker Compose v2
- Domain (masalan `ishifo.uz`) va DNS
- SSL sertifikat (Let's Encrypt yoki o'z sertifikatingiz)
- Kamida 4 GB RAM, 2 CPU, 40 GB disk

## 1. Muhit sozlash

```bash
cp .env.example .env
# .env faylini tahrirlang — barcha CHANGE_ME qiymatlarini almashtiring
```

**Majburiy o'zgaruvchilar:**
- `POSTGRES_PASSWORD` — kuchli parol
- `JWT_SECRET` — kamida 64 belgili tasodifiy satr
- `S3_ACCESS_KEY` / `S3_SECRET_KEY` — MinIO uchun
- `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` — birinchi admin
- `CORS_ORIGINS` — production domeningiz
- `NEXT_PUBLIC_API_URL` — `https://ishifo.uz` (nginx orqali)

## 2. SSL sertifikat

**Test (self-signed):**
```bash
sh scripts/generate-ssl.sh
```

**Production (Let's Encrypt):**
Sertifikatlarni `infra/nginx/ssl/fullchain.pem` va `privkey.pem` ga joylang.

## 3. Ishga tushirish

```bash
# SSL sertifikatlar mavjudligini tekshiring
docker compose --profile prod up -d --build
```

Konteynerlar:
| Xizmat | Port (ichki) | Vazifa |
|--------|--------------|--------|
| nginx | 80, 443 | Reverse proxy, SSL |
| web | 3000 | Next.js frontend |
| api | 3001 | NestJS API |
| postgres | 5432 | Ma'lumotlar bazasi |
| redis | 6379 | Cache |
| minio | 9000 | Fayl saqlash |

## 4. Birinchi marta bootstrap

Migratsiya avtomatik ishlaydi (`migrate` job). Admin yaratish:

```bash
docker compose --profile prod exec api \
  npx ts-node prisma/bootstrap.ts
```

**Muhim:** Bootstrap dan keyin `.env` dan `ADMIN_BOOTSTRAP_PASSWORD` ni o'chiring.

## 5. Tekshirish

```bash
curl https://ishifo.uz/api/health
curl https://ishifo.uz/api/health/ready
```

## 6. Zaxira (backup)

```bash
sh scripts/backup/postgres.sh
```

Cron orqali kunlik zaxira tavsiya etiladi.

## 7. Yangilash

```bash
git pull
docker compose --profile prod up -d --build
```

Migratsiya avtomatik qo'llanadi.

## 8. SMTP (ixtiyoriy)

Email bildirishnomalar uchun `.env` ga SMTP sozlamalarini qo'shing:
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@ishifo.uz
```

## 9. Xavfsizlik checklist

- [ ] `JWT_SECRET` o'zgartirilgan
- [ ] `ALLOW_SEED=false`
- [ ] `SWAGGER_ENABLED=false`
- [ ] `SHOW_DEV_CREDENTIALS=false`
- [ ] Haqiqiy SSL sertifikat
- [ ] Firewall: faqat 80, 443 ochiq
- [ ] Kunlik PostgreSQL backup

## 10. Muammolarni bartaraf etish

**API ishlamayapti:**
```bash
docker compose --profile prod logs api
```

**Migratsiya xatoligi:**
```bash
docker compose --profile prod run --rm migrate
```

**MinIO ulanmadi:**
```bash
docker compose --profile prod logs minio
```

**Nginx SSL xatoligi:**
Sertifikat fayllari `infra/nginx/ssl/` da mavjudligini tekshiring.
