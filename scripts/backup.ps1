# ====================================================================
# Pharmacy Inventory System — Automated Database Backup (PowerShell)
# ====================================================================

$ComposeFile = if ($env:COMPOSE_FILE) { $env:COMPOSE_FILE } else { "deploy/docker-compose.yml" }
$DbService = if ($env:DB_SERVICE) { $env:DB_SERVICE } else { "db" }
$DbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "pharmacy_user" }
$DbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "pharmacy_db" }
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { "backups" }

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = "$BackupDir\pharmacy_backup_$Timestamp.dump"

Write-Host "=========================================================="
Write-Host "Starting database backup at $(Get-Date)..."
Write-Host "Target Container Service: $DbService"
Write-Host "Database Name:            $DbName"
Write-Host "Backup Output:            $BackupFile"
Write-Host "=========================================================="

# Stream dump using binary redirection
cmd.exe /c "docker compose -f $ComposeFile exec -T $DbService pg_dump -U $DbUser -d $DbName -Fc > `"$BackupFile`""

if (Test-Path $BackupFile) {
    $Size = (Get-Item $BackupFile).Length
    if ($Size -gt 0) {
        Write-Host "Backup completed successfully!"
        Write-Host "Backup file: $BackupFile (Size: $Size bytes)"
        exit 0
    }
}

Write-Error "Backup file is empty or failed to generate."
exit 1
