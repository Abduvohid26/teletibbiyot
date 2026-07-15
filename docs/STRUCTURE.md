# iShifo — Loyiha Strukturasi

Bu hujjat monorepo fayl tuzilmasini va har bir papkaning vazifasini tavsiflaydi.

## Umumiy ko'rinish

```
ishifo/                              # npm workspaces monorepo
│
├── apps/                            # Ishga tushadigan ilovalar
│   ├── api/                         # NestJS backend (@ishifo/api)
│   └── web/                         # Next.js frontend (@ishifo/web)
│
├── packages/                        # Umumiy kutubxonalar
│   └── shared/                      # TypeScript tiplar va konstantalar (@ishifo/shared)
│
├── e2e/                             # Playwright end-to-end testlar
├── infra/                           # Nginx, Prometheus, Grafana konfiguratsiyalari
├── scripts/                         # Deploy, backup, SSL skriptlar
│   └── with-root-env.js             # Root .env yuklovchi (prisma, seed)
├── docs/                            # Hujjatlar
│
├── docker-compose.yml               # Bitta fayl (profiles: app, prod, monitoring, ops)
├── playwright.config.ts
├── package.json                     # Root workspace skriptlari
├── .env.example                     # Muhit o'zgaruvchilari shabloni
└── README.md                        # Asosiy hujjat
```

---

## `apps/api/` — Backend (NestJS)

```
apps/api/
├── prisma/
│   ├── schema.prisma              # DB sxemasi (manba)
│   ├── migrations/                # Migratsiya fayllari
│   ├── seed.ts                    # Dev test ma'lumotlari
│   ├── bootstrap.ts               # Production bootstrap
│   └── encrypt-existing-patients.ts
│
├── src/
│   ├── main.ts                    # Kirish nuqtasi
│   ├── app.module.ts              # Root modul
│   │
│   ├── auth/                      # JWT, login
│   ├── users/                     # Foydalanuvchilar CRUD
│   ├── patients/                  # Bemorlar
│   ├── consultations/             # Konsultatsiya hayot sikli
│   ├── ai/                        # OpenAI tahlil
│   ├── video/                     # WebSocket / WebRTC signaling
│   ├── attachments/               # Fayl yuklash (MinIO)
│   ├── audit/                     # Audit jurnali
│   ├── dashboard/                 # Statistika
│   ├── analytics/                 # Analitika va qidiruv
│   ├── devices/                   # UT qurilmalar
│   ├── facilities/                # Muassasalar
│   ├── integrations/              # OneID, DICOM, retsept
│   ├── compliance/                # Ma'lumot saqlash muddati
│   ├── recordings/                # Video yozuvlar
│   ├── notifications/             # Email/SMS bildirishnomalar
│   ├── messages/                  # Konsultatsiya xabarlari
│   ├── appointments/              # Uchrashuvlar
│   ├── reports/                   # Hisobotlar
│   ├── templates/                 # Shablonlar
│   ├── metrics/                   # Prometheus metrikalar
│   ├── health/                    # Health check endpointlar
│   ├── storage/                   # MinIO client
│   ├── prisma/                    # Prisma service
│   └── common/                    # Umumiy utilitlar, guardlar, filterlar
│
├── Dockerfile
├── jest.config.js
├── nest-cli.json
└── package.json
```

### Modul konventsiyasi

Har bir feature modul quyidagi tuzilmaga amal qiladi:

```
feature/
├── feature.module.ts
├── feature.controller.ts
├── feature.service.ts
└── dto/
    └── feature.dto.ts
```

Unit testlar (`*.spec.ts`) hozircha `common/` ichida modul yonida joylashgan.

---

## `apps/web/` — Frontend (Next.js 15)

```
apps/web/
├── public/                        # Statik fayllar
│   ├── favicon.svg
│   └── service-worker.js
│
├── src/
│   ├── middleware.ts              # Route himoyasi (RBAC)
│   │
│   ├── app/                       # Next.js App Router sahifalar
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Rol bo'yicha redirect
│   │   ├── login/
│   │   ├── ut/                    # UT operator (bemor qabul)
│   │   ├── dashboard/             # MT shifokor paneli
│   │   └── admin/                 # Admin panel
│   │
│   ├── components/                # React komponentlar
│   │   ├── dashboard/             # Shifokor paneli komponentlari
│   │   ├── video/                 # WebRTC video
│   │   ├── vitals/                # Vital ko'rsatkichlar
│   │   ├── analytics/             # Grafik va qidiruv
│   │   ├── attachments/           # Fayl biriktirish
│   │   ├── auth/                  # Auth UI
│   │   ├── layout/                # Sidebar, TopBar, shell
│   │   └── ui/                    # Umumiy UI primitivlar
│   │
│   ├── hooks/                     # Custom React hooklar
│   │   ├── use-debounce.ts
│   │   ├── use-require-auth.ts
│   │   ├── use-doctor-dashboard.ts
│   │   ├── use-video-room.ts
│   │   └── ...
│   │
│   └── lib/                       # Utility va API client
│       ├── api/                   # HTTP client modullari
│       ├── auth-context.tsx
│       ├── auth-utils.ts
│       └── ...
│
├── Dockerfile
├── next.config.js
├── tailwind.config.js
└── package.json
```

### Papka qoidalari

| Papka | Nima qo'yiladi |
|-------|----------------|
| `app/` | Faqat sahifalar va route-specific komponentlar |
| `components/` | Qayta ishlatiladigan UI komponentlar |
| `hooks/` | Barcha custom React hooklar (`use*` fayllar) |
| `lib/` | Pure utility, API client, context providerlar |

---

## `packages/shared/` — Umumiy tiplar

```
packages/shared/
├── src/
│   ├── index.ts                   # UserRole, ConsultationStatus, tiplar
│   ├── brand.ts                   # Brend konstantalar
│   └── prescription-templates.ts
├── dist/                          # Compiled output (gitignore)
├── tsconfig.json
└── package.json
```

`@ishifo/shared` ikkala app tomonidan ishlatiladi. **Faqat `.ts` fayllar** `src/` ichida bo'lishi kerak — compiled `.js` fayllar `dist/` ga tushadi.

---

## `e2e/` — End-to-end testlar

```
e2e/
├── helpers/
│   ├── api-client.ts
│   └── login.ts
├── auth.spec.ts
├── consultation-flow.spec.ts
├── consultation-ui.spec.ts
├── manager-flow.spec.ts
├── recordings-access.spec.ts
├── roles-and-health.spec.ts
├── security-dicom.spec.ts
└── websocket-auth.spec.ts
```

Ishga tushirish: `npm run test:e2e`

---

## `infra/` — Infratuzilma konfiguratsiyalari

```
infra/
├── nginx/
│   ├── nginx.conf                 # HTTPS reverse proxy
│   ├── nginx.http.conf            # HTTP-only fallback
│   └── ssl/                       # SSL sertifikatlar (gitignore)
├── prometheus/
│   └── prometheus.yml
└── grafana/
    ├── dashboards/ishifo.json
    └── provisioning/
```

---

## `scripts/` — Operatsion skriptlar

```
scripts/
├── backup/
│   ├── postgres.sh                # PostgreSQL backup
│   ├── postgres.ps1               # Windows variant
│   ├── postgres-restore.sh
│   └── verify-backup.sh
├── bootstrap-prod.sh
├── certbot-init.sh
├── generate-ssl.sh
└── migrate-prod.sh
```

---

## `docs/` — Hujjatlar

```
docs/
├── STRUCTURE.md                   # Bu fayl
├── DEPLOYMENT.md                  # Production deploy qo'llanmasi
├── PILOT.md                       # Pilot tayyorgarlik
├── INCIDENT_RESPONSE.md           # Favqulodda vaziyatlar
├── USER_MANUAL_MT.md              # MT shifokor qo'llanmasi
└── USER_MANUAL_UT.md              # UT operator qo'llanmasi
```

---

## Gitignore qoidalari

Quyidagilar **hech qachon** commit qilinmaydi:

- `node_modules/`, `dist/`, `.next/`, `*.tsbuildinfo`
- `.env` (yagona muhit fayli — faqat rootda)
- `test-results/`, `playwright-report/`
- `tmp-*.js` (vaqtinchalik debug skriptlar)
- `packages/shared/src/*.js` (noto'g'ri joydagi build output)

---

## Workspace skriptlari

| Buyruq | Vazifa |
|--------|--------|
| `npm run dev` | API + Web bir vaqtda |
| `npm run build` | Barcha workspace build |
| `npm run lint` | Frontend ESLint |
| `npm run typecheck` | TypeScript kompilatsiya tekshiruvi |
| `npm run test` | Unit + E2E testlar |
| `npm run test:all` | Docker + migrate + unit + E2E (to'liq suite) |
| `npm run docker:app:up` | Staging to'liq stack |
| `npm run docker:prod:up` | Production stack |
| `npm run docker:monitoring:up` | Prometheus + Grafana |
| `npm run db:migrate` | Prisma migratsiya |
| `npm run db:seed` | Test ma'lumotlar |

---

## Yangi feature qo'shish

### Backend modul

```bash
cd apps/api
npx nest g module feature-name
npx nest g controller feature-name
npx nest g service feature-name
```

### Frontend sahifa

```
apps/web/src/app/dashboard/yangi-sahifa/page.tsx
```

### Umumiy tip

```
packages/shared/src/index.ts  # enum yoki interface qo'shing
npm run build --workspace=@ishifo/shared
```
