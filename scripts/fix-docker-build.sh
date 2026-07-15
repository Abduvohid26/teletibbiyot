#!/bin/bash
# Serverda Docker build xatosini tuzatish (storage + multer types)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> .dockerignore tuzatish..."
sed -i 's/^storage$/\/storage/' .dockerignore
grep -q '!apps/api/src/storage' .dockerignore || sed -i '/^\/storage$/a !apps/api/src/storage\n!apps/api/src/storage/**' .dockerignore

echo "==> Storage moduli tekshiruv..."
test -f apps/api/src/storage/storage.module.ts || {
  echo "XATO: apps/api/src/storage/ yo'q — git pull qiling yoki kodni yangilang"
  exit 1
}

echo "==> API Dockerfile..."
cat > apps/api/Dockerfile <<'DOCKERFILE'
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache wget

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --ignore-scripts --include=dev

FROM base AS builder
COPY --from=deps /app ./
COPY . .
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=@ishifo/shared
RUN npm run build --workspace=@ishifo/api

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/package.json ./
WORKDIR /app/apps/api
USER nestjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health/ready || exit 1
CMD ["node", "dist/main.js"]
DOCKERFILE

echo "==> Web Dockerfile..."
cat > apps/web/Dockerfile <<'DOCKERFILE'
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --ignore-scripts --include=dev

FROM base AS builder
COPY --from=deps /app ./
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_TURN_URL=
ARG NEXT_PUBLIC_TURN_USERNAME=
ARG NEXT_PUBLIC_TURN_CREDENTIAL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TURN_URL=$NEXT_PUBLIC_TURN_URL
ENV NEXT_PUBLIC_TURN_USERNAME=$NEXT_PUBLIC_TURN_USERNAME
ENV NEXT_PUBLIC_TURN_CREDENTIAL=$NEXT_PUBLIC_TURN_CREDENTIAL
RUN npm run build --workspace=@ishifo/web

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache wget
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
RUN chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
DOCKERFILE

echo "==> Tekshiruv..."
grep "COPY --from=deps /app ./" apps/api/Dockerfile apps/web/Dockerfile
grep -E '^/storage|!apps/api/src/storage' .dockerignore
ls apps/api/src/storage/

echo ""
echo "OK. Endi ishga tushiring:"
echo "  docker compose --profile app build --no-cache api"
echo "  docker compose --profile app up -d --build"
