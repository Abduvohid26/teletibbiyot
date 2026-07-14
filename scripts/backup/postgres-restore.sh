#!/usr/bin/env bash
# PostgreSQL restore — backup dan tiklash
# Foydalanish: ./scripts/backup/postgres-restore.sh backups/postgres/ishifo_20260101_120000.sql.gz
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Foydalanish: $0 <backup.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER="${POSTGRES_CONTAINER:-ishifo-db}"
DB_USER="${POSTGRES_USER:-ishifo}"
DB_NAME="${POSTGRES_DB:-ishifo}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup fayl topilmadi: $BACKUP_FILE" >&2
  exit 1
fi

echo "[$(date)] DIQQAT: $DB_NAME bazasi $BACKUP_FILE dan tiklanadi"
read -r -p "Davom etasizmi? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Bekor qilindi"
  exit 0
fi

echo "[$(date)] Restore boshlandi..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
echo "[$(date)] Restore muvaffaqiyatli yakunlandi"
