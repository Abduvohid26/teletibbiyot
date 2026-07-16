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

PSQL=(docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1)

echo "==> Migratsiya holati (oldin)"
"${PSQL[@]}" -c \
  "SELECT migration_name, finished_at, rolled_back_at, started_at, LEFT(logs, 200) AS logs
   FROM _prisma_migrations
   WHERE migration_name LIKE '%three_roles%'
   ORDER BY started_at;"

echo "==> Enum holati (oldin)"
"${PSQL[@]}" -c \
  "SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
   FROM pg_type t
   JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname LIKE 'UserRole%'
   GROUP BY t.typname;"

echo "==> DB ni qo'lda tiklash (idempotent SQL)"
docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 \
  < scripts/repair-three-roles-db.sql

echo "==> Failed yozuvlarni tozalash va applied deb belgilash"
docker compose --profile app build api migrate
docker compose --profile app run --rm --entrypoint '' migrate \
  npx prisma migrate resolve --rolled-back 20260716140000_three_roles_only || true
docker compose --profile app run --rm --entrypoint '' migrate \
  npx prisma migrate resolve --applied 20260716140000_three_roles_only

echo "==> Tekshirish: migrate deploy"
docker compose --profile app run --rm --entrypoint '' migrate \
  npx prisma migrate deploy

echo "==> API va web ishga tushirish"
docker compose --profile app up -d api web seed

echo "==> Enum holati (keyin)"
"${PSQL[@]}" -c \
  "SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
   FROM pg_type t
   JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname LIKE 'UserRole%'
   GROUP BY t.typname;"

echo "==> Foydalanuvchilar"
"${PSQL[@]}" -c 'SELECT email, role::text FROM "User" ORDER BY email;'

sleep 5
docker compose --profile app logs api --tail 20
