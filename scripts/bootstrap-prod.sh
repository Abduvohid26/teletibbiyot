#!/usr/bin/env bash
# Production bootstrap — faqat birinchi deploy da
# ADMIN_BOOTSTRAP_EMAIL va ADMIN_BOOTSTRAP_PASSWORD .env da bo'lishi kerak
set -euo pipefail
cd "$(dirname "$0")/../apps/api"
export NODE_ENV=production
export ALLOW_SEED=false
npx ts-node prisma/bootstrap.ts
echo "Bootstrap yakunlandi."
