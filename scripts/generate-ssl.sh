#!/bin/sh
# Self-signed SSL sertifikat yaratish (birinchi deploy yoki test uchun)
# Ishlatish: sh scripts/generate-ssl.sh

set -e
DIR="$(dirname "$0")/../infra/nginx/ssl"
mkdir -p "$DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$DIR/privkey.pem" \
  -out "$DIR/fullchain.pem" \
  -subj "/CN=localhost/O=Ishifo/C=UZ"

echo "SSL sertifikatlar yaratildi: $DIR"
echo "Production uchun Let's Encrypt yoki haqiqiy sertifikatdan foydalaning."
