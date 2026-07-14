#!/usr/bin/env bash
# Backup faylini tekshirish
set -euo pipefail

FILE="${1:?Backup fayl yo'li kerak: ./verify-backup.sh backups/postgres/ishifo_xxx.sql.gz}"

if [[ ! -f "$FILE" ]]; then
  echo "XATO: Fayl topilmadi: $FILE"
  exit 1
fi

echo "Backup hajmi: $(du -h "$FILE" | cut -f1)"
gunzip -t "$FILE" && echo "gzip integrity: OK"

# SQL sarlavhasini ko'rsatish
gunzip -c "$FILE" | head -n 5
echo "..."
echo "Backup tekshiruvi muvaffaqiyatli"
