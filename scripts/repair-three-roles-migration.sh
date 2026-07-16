#!/usr/bin/env bash
# Muvaffaqiyatsiz 20260716140000_three_roles_only migratsiyasini tiklash.
# Ishlatish: /home/teletibbiyot ichida: bash scripts/repair-three-roles-migration.sh

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

echo "==> Failed migratsiya holati"
docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c \
  "SELECT migration_name, finished_at, rolled_back_at, started_at FROM _prisma_migrations WHERE migration_name LIKE '%three_roles%';"

echo "==> Failed migratsiyani rolled-back deb belgilash"
docker compose --profile app run --rm --entrypoint '' migrate \
  npx prisma migrate resolve --rolled-back 20260716140000_three_roles_only

echo "==> Qayta build va migrate"
docker compose --profile app build api
docker compose --profile app run --rm migrate
docker compose --profile app up -d api web

echo "==> API health"
sleep 5
docker compose --profile app logs api --tail 15
