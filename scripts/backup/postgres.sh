#!/usr/bin/env bash
# PostgreSQL backup — cron: 0 2 * * * /path/to/postgres.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER="${POSTGRES_CONTAINER:-ishifo-db}"
DB_USER="${POSTGRES_USER:-ishifo}"
DB_NAME="${POSTGRES_DB:-ishifo}"

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/ishifo_${TIMESTAMP}.sql.gz"

echo "[$(date)] Backup boshlandi: $FILE"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
echo "[$(date)] Backup yakunlandi: $(du -h "$FILE" | cut -f1)"

find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Eski backup lar tozalandi (>$RETENTION_DAYS kun)"
