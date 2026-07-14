# iShifo Platformasi

**Jamoat Salomatligi Tibbiyot Instituti (FJSTI) — iShifo**  
O'zbekiston va xalqaro miqyosda uzoq masofadagi tibbiyot muassasalari (UT) va markaziy shifoxona (MT) o'rtasida AI-yordamida masofaviy konsultatsiya va tashxis tizimi.

| Parametr | Qiymat |
|----------|--------|
| Versiya | 1.2.0 |
| Holat | Pilotga tayyor |
| Til | O'zbek (lotin) |
| Monorepo | npm workspaces |

---

## Mundarija

1. [Loyiha haqida](#loyiha-haqida)
2. [Arxitektura](#arxitektura)
3. [Texnologik stack](#texnologik-stack)
4. [Loyiha strukturasi](#loyiha-strukturasi)
5. [Talablar](#talablar)
6. [Tez boshlash (local dev)](#tez-boshlash-local-dev)
7. [Muhit o'zgaruvchilari (.env)](#muhit-ozgaruvchilari-env)
8. [Docker Compose](#docker-compose)
9. [Skriptlar](#skriptlar)
10. [Foydalanuvchi rollari va test loginlar](#foydalanuvchi-rollari-va-test-loginlar)
11. [Frontend sahifalar](#frontend-sahifalar)
12. [Backend va API](#backend-va-api)
13. [Testlar](#testlar)
14. [Production deploy](#production-deploy)
15. [Xavfsizlik](#xavfsizlik)
16. [Muammolarni bartaraf etish](#muammolarni-bartaraf-etish)
17. [Qo'shimcha hujjatlar](#qoshimcha-hujjatlar)

---

## Loyiha haqida

iShifo — uzoq masofadagi tibbiyot muassasalaridagi bemorlarga markaziy mutaxassis shifokorlar masofadan konsultatsiya berish imkonini yaratadi. AI tizimi faqat **yordamchi** sifatida ishlaydi; yakuniy tashxis va davolash qarori faqat malakali shifokorga tegishli.

### Asosiy imkoniyatlar

- Real vaqt video-audio konsultatsiya (WebRTC + Socket.IO)
- 5 bosqichli UT wizard — bemor qabul, orqaga qaytish, PINFL validatsiya
- AI dastlabki tahlil: differensial tashxis, xavf darajasi, tavsiyalar
- Vital ko'rsatkichlar paneli (EKG, puls, qon bosimi, SpO2, harorat)
- Konsultatsiya navbati, yakuniy tashxis, xabarlar, uchrashuvlar
- RBAC, MFA (TOTP), audit jurnali
- Fayl biriktirish (PDF, JPG, DICOM — MinIO orqali)
- OneID, retsept, DICOM integratsiya adapterlari
- Prometheus + Grafana monitoring

---

## Arxitektura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FOYDALANUVCHILAR                          │
├──────────────┬────────────────────┬─────────────────────────────┤
│  UT Operator │   MT Shifokor      │   Admin / Auditor           │
│  /ut         │   /dashboard       │   /admin, /admin/audit      │
└──────┬───────┴─────────┬──────────┴──────────────┬─────────────┘
       │                 │                          │
       ▼                 ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js 15 Frontend  (port 3000)                    │
│              middleware.ts — route himoyasi (RBAC)               │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST + WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              NestJS 11 API  (port 3001)                          │
│  Auth │ Patients │ Consultations │ AI │ Video │ Attachments      │
│  Audit │ Dashboard │ Devices │ Health │ Integrations │ Metrics   │
└──────┬──────────────┬──────────────┬───────────────────────────┘
       │              │              │
       ▼              ▼              ▼
  PostgreSQL       Redis          MinIO
  (5432/5433)     (6379)         (9000/9001)
       │
       ▼
  coturn TURN (3478) — WebRTC NAT traversal
```

---

## Texnologik stack

| Qatlam | Texnologiya |
|--------|-------------|
| Frontend | Next.js 15, React 19, Tailwind CSS, Socket.IO client |
| Backend | NestJS 11, Prisma 6, Passport JWT, Socket.IO |
| Ma'lumotlar bazasi | PostgreSQL 16 |
| Cache / pub-sub | Redis 7 |
| Fayl saqlash | MinIO (S3-compatible) |
| Video | WebRTC + coturn |
| AI | OpenAI API (mock rejim mavjud) |
| Testlar | Jest (unit), Playwright (E2E) |
| Infra | Docker Compose (profiles), Nginx, Prometheus, Grafana |
| Monorepo | npm workspaces + `@ishifo/shared` |

---

## Loyiha strukturasi

```
ishifo/
├── apps/
│   ├── api/          # NestJS backend (@ishifo/api)
│   └── web/          # Next.js frontend (@ishifo/web)
├── packages/
│   └── shared/       # Umumiy TypeScript tiplar (@ishifo/shared)
├── e2e/              # Playwright E2E testlar
├── infra/            # Nginx, Prometheus, Grafana
├── scripts/          # Deploy, backup, SSL, with-root-env.js
├── docs/             # Batafsil hujjatlar
├── docker-compose.yml
├── .env.example      # Muhit shabloni (commit qilinadi)
├── .env              # Haqiqiy sozlamalar (gitignore)
├── playwright.config.ts
└── package.json
```

Batafsil tuzilma: [`docs/STRUCTURE.md`](docs/STRUCTURE.md)

---

## Talablar

| Vosita | Versiya |
|--------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Docker | 24+ |
| Docker Compose | v2 |

---

## Tez boshlash (local dev)

### 1. Repozitoriy va dependencies

```bash
git clone <repo-url> ishifo
cd ishifo
npm install
```

### 2. Muhit fayli

```bash
cp .env.example .env
# .env ni tahrirlang (JWT_SECRET, OPENAI_API_KEY va hokazo)
```

> **Eslatma:** Barcha sozlamalar faqat root `.env` da. `apps/api/.env` yoki `apps/web/.env.local` ishlatilmaydi.

### 3. Docker infratuzilma

```bash
npm run docker:up
# yoki: docker compose up -d
```

Ishga tushadi:

| Xizmat | Konteyner | Host port (default) |
|--------|-----------|---------------------|
| PostgreSQL | `ishifo-db` | 5433 (`POSTGRES_PUBLISH`) |
| Redis | `ishifo-redis` | 6379 |
| MinIO | `ishifo-minio` | 9000 (API), 9001 (console) |
| TURN | `ishifo-turn` | 3478 |

> Port 5432 band bo'lsa, `.env` da `POSTGRES_PUBLISH=5433` qiling va `DATABASE_URL` dagi portni moslashtiring.

### 4. Ma'lumotlar bazasi

```bash
npm run db:migrate      # migratsiya
npm run db:seed         # test ma'lumotlari (ALLOW_SEED=true bo'lishi kerak)
```

### 5. Ilovani ishga tushirish

```bash
npm run dev
```

| Xizmat | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/api/docs |
| MinIO Console | http://localhost:9001 |

---

## Muhit o'zgaruvchilari (.env)

Yagona muhit fayli — loyiha **rootida** `.env`. Docker Compose ham shu fayldan o'qiydi (`env_file: .env`).

Shablon: [`.env.example`](.env.example)

### Local vs Docker URL lar

| O'zgaruvchi | Qachon | Misol |
|-------------|--------|-------|
| `DATABASE_URL` | `npm run dev` (host → docker) | `postgresql://...@localhost:5433/ishifo` |
| `DATABASE_URL_DOCKER` | Docker ichidagi servislar | `postgresql://...@postgres:5432/ishifo` |
| `REDIS_URL` | Local dev | `redis://localhost:6379` |
| `REDIS_URL_DOCKER` | Docker ichida | `redis://redis:6379` |
| `S3_ENDPOINT` | Local dev | `http://localhost:9000` |
| `S3_ENDPOINT_DOCKER` | Docker ichida | `http://minio:9000` |

### Asosiy o'zgaruvchilar

| Guruh | O'zgaruvchilar |
|-------|----------------|
| Docker portlar | `POSTGRES_PUBLISH`, `API_PUBLISH`, `WEB_PUBLISH`, `MINIO_PUBLISH`, ... |
| Database | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `DATABASE_URL_DOCKER` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `COOKIE_SECURE`, `MFA_REQUIRED_ROLES` |
| AI | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| S3/MinIO | `S3_*`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` |
| Frontend | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TURN_*`, `WEB_APP_URL` |
| WebRTC | `TURN_USERNAME`, `TURN_PASSWORD`, `TURN_REALM`, `TURN_URL` |
| Dev | `ALLOW_SEED`, `SEED_PASSWORD`, `SWAGGER_ENABLED`, `STAGING` |
| Production | `ADMIN_BOOTSTRAP_*`, `ENCRYPTION_KEY`, `METRICS_BEARER_TOKEN` |
| Monitoring | `GRAFANA_PASSWORD`, `PROMETHEUS_PUBLISH`, `GRAFANA_PUBLISH` |

Prisma va seed skriptlari root `.env` ni `scripts/with-root-env.js` orqali yuklaydi. API — `apps/api/src/env.config.ts`, Web — `next.config.js`.

---

## Docker Compose

Bitta `docker-compose.yml` fayl — **profiles** orqali turli rejimlar:

| Profile | Buyruq | Nima ishga tushadi |
|---------|--------|-------------------|
| *(default)* | `docker compose up -d` | postgres, redis, minio, turn |
| `app` | `docker compose --profile app up -d --build` | infra + migrate + seed + api + web |
| `prod` | `docker compose --profile prod up -d --build` | infra + migrate + bootstrap + api + web + nginx + coturn |
| `monitoring` | `docker compose --profile monitoring up -d` | prometheus + grafana |
| `ops` | `docker compose --profile ops up -d` | kunlik postgres backup |

### npm skriptlari (qisqa yo'l)

```bash
npm run docker:up              # infra
npm run docker:down
npm run docker:app:up          # to'liq staging stack
npm run docker:app:down
npm run docker:prod:up         # production
npm run docker:prod:down
npm run docker:monitoring:up   # prometheus + grafana
```

### Production stack

```bash
cp .env.example .env
# Production qiymatlarini kiriting
sh scripts/generate-ssl.sh     # test SSL (yoki Let's Encrypt)
docker compose --profile prod up -d --build
```

Batafsil: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

## Skriptlar

| Skript | Vazifa |
|--------|--------|
| `npm run dev` | API + Web parallel ishga tushirish |
| `npm run build` | Barcha workspace build |
| `npm run typecheck` | API + Web typecheck |
| `npm run lint` | Web ESLint |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:migrate:deploy` | Prisma migrate deploy |
| `npm run db:seed` | Test ma'lumotlari |
| `npm run db:bootstrap` | Production admin bootstrap |
| `npm run db:studio` | Prisma Studio |
| `npm run test` | Unit + E2E |
| `npm run test:unit` | Jest (API) |
| `npm run test:e2e` | Playwright |
| `npm run test:all` | To'liq test suite (`scripts/test-all.sh`) |
| `npm run ssl:generate` | Self-signed SSL |

---

## Foydalanuvchi rollari va test loginlar

Seed (`npm run db:seed`) dan keyin:

| Rol | Email | Parol (default) |
|-----|-------|-----------------|
| MT Shifokor | `doctor@ishifo.uz` | `password123` |
| UT Operator | `operator@ishifo.uz` | `password123` |
| Admin | `admin@ishifo.uz` | `password123` |

Parol `.env` dagi `SEED_PASSWORD` orqali o'zgartiriladi.

| Rol | Ruxsatlar |
|-----|-----------|
| `UT_OPERATOR` | Bemor qabul, vital, konsultatsiya boshlash |
| `MT_DOCTOR` | Navbat, video, tashxis, AI tahlil |
| `ADMIN` | Foydalanuvchilar, audit, sozlamalar |
| `AUDITOR` | Faqat audit jurnali |

---

## Frontend sahifalar

| Yo'l | Rol | Vazifa |
|------|-----|--------|
| `/login` | Hammaga | Kirish |
| `/ut` | UT | Bemor qabul wizard (5 bosqich) |
| `/ut/vitals` | UT | Vital ko'rsatkichlar |
| `/dashboard` | MT | Asosiy panel |
| `/dashboard/consultations` | MT | Konsultatsiyalar |
| `/dashboard/patients` | MT | Bemorlar |
| `/dashboard/triage` | MT | Navbat / triage |
| `/dashboard/ai` | MT | AI tahlil |
| `/dashboard/dicom` | MT | DICOM ko'rish |
| `/dashboard/devices` | MT | UT qurilmalar |
| `/dashboard/messages` | MT | Xabarlar |
| `/dashboard/appointments` | MT | Uchrashuvlar |
| `/dashboard/recordings` | MT | Video yozuvlar |
| `/dashboard/reports` | MT | Hisobotlar |
| `/dashboard/settings` | MT | Sozlamalar (MFA) |
| `/admin` | Admin | Boshqaruv paneli |
| `/admin/audit` | Admin/Auditor | Audit jurnali |

---

## Backend va API

### Modullar

`auth` · `users` · `patients` · `consultations` · `ai` · `video` · `attachments` · `audit` · `dashboard` · `analytics` · `devices` · `facilities` · `integrations` · `compliance` · `recordings` · `notifications` · `messages` · `appointments` · `reports` · `templates` · `metrics` · `health` · `storage`

### Health check

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/health/ready
```

### Swagger

`SWAGGER_ENABLED=true` bo'lganda: **http://localhost:3001/api/docs**

---

## Testlar

### Unit testlar (Jest)

```bash
npm run test:unit
```

Hozirgi testlar: `pinfl.util.spec.ts`, `patient-search.util.spec.ts`, health va boshqalar.

### E2E testlar (Playwright)

```bash
npm run test:e2e:install   # birinchi marta — Chromium
npm run test:e2e
```

E2E oldin API va Web ishlashi kerak (`npm run dev` yoki Docker `app` profile).

### Hammasi birdan

```bash
npm run test:all
```

---

## Production deploy

1. `.env` ni production qiymatlari bilan to'ldiring (`JWT_SECRET`, `POSTGRES_PASSWORD`, `ENCRYPTION_KEY`, ...)
2. SSL sertifikatni `infra/nginx/ssl/` ga joylang
3. `docker compose --profile prod up -d --build`
4. Bootstrap avtomatik ishlaydi; keyin `ADMIN_BOOTSTRAP_PASSWORD` ni `.env` dan olib tashlang
5. Monitoring: `docker compose --profile monitoring up -d`

Qo'llanmalar:

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deploy
- [`docs/PILOT.md`](docs/PILOT.md) — pilot rejimi
- [`docs/INCIDENT_RESPONSE.md`](docs/INCIDENT_RESPONSE.md) — incident response

---

## Xavfsizlik

- JWT httpOnly cookie + RBAC middleware
- MFA (TOTP) — `ADMIN`, `MT_DOCTOR` rollari uchun
- Helmet, CORS, rate limiting (Throttler)
- Bemor ma'lumotlari field-level encryption (`ENCRYPTION_KEY`)
- Audit jurnal — barcha muhim amallar
- `.env` hech qachon git ga commit qilinmaydi
- Production: `COOKIE_SECURE=true`, `SWAGGER_ENABLED=false`, `ALLOW_SEED=false`

---

## Muammolarni bartaraf etish

### Port band

```bash
# Qaysi process band qilganini ko'rish
ss -tlnp | grep -E '5432|5433|3000|3001'

# .env da portni o'zgartirish
POSTGRES_PUBLISH=5433
DATABASE_URL=postgresql://...@localhost:5433/...
```

### Prisma binary xatosi (Linux/Windows)

`apps/api/prisma/schema.prisma` da `binaryTargets = ["native", "debian-openssl-3.0.x"]` mavjud. Qayta generate:

```bash
npm run postinstall
```

### Redis ulanmayapti

Local dev: `REDIS_URL=redis://localhost:6379`  
Docker: `REDIS_URL_DOCKER=redis://redis:6379`

### Docker build sekin

`.dockerignore` build contextni ~1.5 MB ga qisqartiradi. `node_modules` va `.next` image ichida qayta build qilinadi.

### E2E login throttling

E2E rejimida (`E2E=true`) yoki dev muhitda login endpoint throttle limiti oshirilgan.

### Loglar

```bash
docker compose logs -f api
docker compose logs -f web
docker compose --profile prod logs -f nginx
```

---

## Qo'shimcha hujjatlar

| Hujjat | Mazmun |
|--------|--------|
| [`docs/STRUCTURE.md`](docs/STRUCTURE.md) | Fayl tuzilmasi |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production deploy |
| [`docs/PILOT.md`](docs/PILOT.md) | Pilot rejimi |
| [`docs/USER_MANUAL_UT.md`](docs/USER_MANUAL_UT.md) | UT operator qo'llanmasi |
| [`docs/USER_MANUAL_MT.md`](docs/USER_MANUAL_MT.md) | MT shifokor qo'llanmasi |
| [`docs/INCIDENT_RESPONSE.md`](docs/INCIDENT_RESPONSE.md) | Incident response |

---

## Litsenziya

FJSTI ichki loyiha. Tashqi tarqatish ruxsati alohida kelishiladi.

---

**iShifo** — masofaviy tibbiyot kelajagi uchun.
