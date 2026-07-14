#!/usr/bin/env bash
# Production migration — bir martalik ishga tushiring
set -euo pipefail
cd "$(dirname "$0")/../apps/api"
echo "Prisma migrate deploy..."
npx prisma migrate deploy
echo "Migration muvaffaqiyatli."
