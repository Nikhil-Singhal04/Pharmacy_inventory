#!/bin/sh
set -e

# ====================================================================
# Pharmacy Inventory System — Automated Database Backup Script
# Uses PostgreSQL pg_dump with custom format (-Fc) for maximum
# compression, integrity checking, and selective object restoration.
# ====================================================================

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${POSTGRES_USER:-pharmacy_user}"
DB_NAME="${POSTGRES_DB:-pharmacy_db}"
BACKUP_DIR="${BACKUP_DIR:-backups}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/pharmacy_backup_${TIMESTAMP}.dump"

echo "=========================================================="
echo "Starting database backup at $(date)..."
echo "Target Container Service: ${DB_SERVICE}"
echo "Database Name:            ${DB_NAME}"
echo "Backup Output:            ${BACKUP_FILE}"
echo "=========================================================="

# Stream custom format dump directly from postgres container
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --verbose > "$BACKUP_FILE"

if [ -s "$BACKUP_FILE" ]; then
  FILE_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
  echo "Backup completed successfully!"
  echo "Backup file: ${BACKUP_FILE} (Size: ${FILE_SIZE})"
else
  echo "Error: Backup file is empty or failed to generate."
  exit 1
fi
