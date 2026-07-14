#!/usr/bin/env bash
# Let's Encrypt SSL — birinchi marta sertifikat olish
# Foydalanish: DOMAIN=ishifo.uz EMAIL=admin@ishifo.uz ./scripts/certbot-init.sh
set -euo pipefail

DOMAIN="${DOMAIN:?DOMAIN kerak (masalan ishifo.uz)}"
EMAIL="${EMAIL:?EMAIL kerak}"
SSL_DIR="$(cd "$(dirname "$0")/.." && pwd)/infra/nginx/ssl"

mkdir -p "$SSL_DIR"

echo "[1/3] Certbot bilan sertifikat olinmoqda: $DOMAIN"
docker run --rm -it \
  -v "$SSL_DIR:/etc/letsencrypt" \
  -v "$SSL_DIR:/var/lib/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

echo "[2/3] Nginx uchun nusxalash"
cp "$SSL_DIR/live/$DOMAIN/fullchain.pem" "$SSL_DIR/fullchain.pem"
cp "$SSL_DIR/live/$DOMAIN/privkey.pem" "$SSL_DIR/privkey.pem"

echo "[3/3] Tayyor. nginx ni qayta ishga tushiring:"
echo "  docker compose --profile prod restart nginx"
echo "Yangilash (cron): 0 3 * * * certbot renew && cp ..."
