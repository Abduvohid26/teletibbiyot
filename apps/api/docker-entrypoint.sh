#!/bin/sh
set -e

echo "[entrypoint] Prisma migratsiyalar tekshirilmoqda..."
npx prisma migrate deploy

exec "$@"
