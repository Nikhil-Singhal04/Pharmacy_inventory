#!/bin/sh
set -e

# ====================================================================
# Pharmacy Inventory System — Automated Database Restore Script
# Restores custom format (-Fc) PostgreSQL dump archives.
# ====================================================================

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${POSTGRES_USER:-pharmacy_user}"
DB_NAME="${POSTGRES_DB:-pharmacy_db}"

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <path_to_backup_file.dump>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file '$BACKUP_FILE' not found!"
  exit 1
fi

echo "=========================================================="
echo "Starting database restoration at $(date)..."
echo "Target Container Service: ${DB_SERVICE}"
echo "Database Name:            ${DB_NAME}"
echo "Source Backup File:       ${BACKUP_FILE}"
echo "=========================================================="

# 1. Terminate other connections so restore can execute cleanly
echo "Terminating active connections on ${DB_NAME}..."
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  psql -U "$DB_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true

# 2. Restore database objects and data using pg_restore
echo "Restoring database objects and data from ${BACKUP_FILE}..."
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner < "$BACKUP_FILE" || true

echo "Restoration complete. Verifying table row counts..."
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
  psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT 'medicines' AS table_name, count(*) AS row_count FROM medicines UNION ALL SELECT 'batches', count(*) FROM batches UNION ALL SELECT 'stock_movements', count(*) FROM stock_movements;"
