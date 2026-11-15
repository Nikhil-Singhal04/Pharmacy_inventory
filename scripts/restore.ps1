# ====================================================================
# Pharmacy Inventory System — Automated Database Restore (PowerShell)
# ====================================================================

param (
    [Parameter(Mandatory=$true, Position=0)]
    [string]$BackupFile
)

$ComposeFile = if ($env:COMPOSE_FILE) { $env:COMPOSE_FILE } else { "deploy/docker-compose.yml" }
$DbService = if ($env:DB_SERVICE) { $env:DB_SERVICE } else { "db" }
$DbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "pharmacy_user" }
$DbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "pharmacy_db" }

if (-not (Test-Path $BackupFile)) {
    Write-Error "Error: Backup file '$BackupFile' not found!"
    exit 1
}

Write-Host "=========================================================="
Write-Host "Starting database restoration at $(Get-Date)..."
Write-Host "Target Container Service: $DbService"
Write-Host "Database Name:            $DbName"
Write-Host "Source Backup File:       $BackupFile"
Write-Host "=========================================================="

# 1. Terminate other connections
Write-Host "Terminating active connections on $DbName..."
docker compose -f $ComposeFile exec -T $DbService psql -U $DbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DbName' AND pid <> pg_backend_pid();" | Out-Null

# 2. Restore database objects and data using binary pipe
Write-Host "Restoring database objects and data from $BackupFile..."
cmd.exe /c "docker compose -f $ComposeFile exec -T $DbService pg_restore -U $DbUser -d $DbName --clean --if-exists --no-owner < `"$BackupFile`""

Write-Host "Restoration complete. Verifying table row counts..."
docker compose -f $ComposeFile exec -T $DbService psql -U $DbUser -d $DbName -c "SELECT 'medicines' AS table_name, count(*) AS row_count FROM medicines UNION ALL SELECT 'batches', count(*) FROM batches UNION ALL SELECT 'stock_movements', count(*) FROM stock_movements;"
