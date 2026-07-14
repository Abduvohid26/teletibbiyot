#!/usr/bin/env bash
# To'liq test suite — unit + E2E
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgresql://ishifo:ishifo_secret@localhost:5433/ishifo?schema=public}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-minimum-32-characters-long}"
export SEED_PASSWORD="${SEED_PASSWORD:-password123}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}"
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"
export E2E=true

echo "==> 1/6 Docker infra"
POSTGRES_PUBLISH="${POSTGRES_PUBLISH:-5433}" docker compose up -d postgres redis minio turn 2>&1 || \
  POSTGRES_PUBLISH=5433 docker compose up -d postgres redis minio turn

echo "==> 2/6 Prisma generate + migrate + seed"
node scripts/with-root-env.js node node_modules/prisma/build/index.js generate --schema=apps/api/prisma/schema.prisma
node scripts/with-root-env.js node node_modules/prisma/build/index.js migrate deploy --schema=apps/api/prisma/schema.prisma
node scripts/with-root-env.js node node_modules/ts-node/dist/bin.js apps/api/prisma/seed.ts

echo "==> 3/6 Unit tests"
npm run test:unit

echo "==> 4/6 Build"
npm run build --workspace=@ishifo/api
npm run build --workspace=@ishifo/web

echo "==> 5/6 Playwright browser"
npx playwright install chromium

echo "==> 6/6 Start services + E2E"
node apps/api/dist/main.js &
API_PID=$!
npm run start --workspace=@ishifo/web &
WEB_PID=$!

cleanup() {
  kill $API_PID $WEB_PID 2>/dev/null || true
}
trap cleanup EXIT

npx wait-on http://localhost:3001/api/health/live http://localhost:3000/login -t 120000
npx playwright test

echo "==> Barcha testlar muvaffaqiyatli o'tdi"
