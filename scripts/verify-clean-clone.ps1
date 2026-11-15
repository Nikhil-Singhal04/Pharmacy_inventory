# ====================================================================
# Pharmacy Inventory System — Clean Clone Verification Script
# Validates Acceptance A2: Reproducibility from a fresh git clone
# ====================================================================

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$TargetDir = Join-Path $env:TEMP "pharmacy_clean_clone_$Timestamp"

Write-Host "=========================================================="
Write-Host "Starting Clean-Clone Verification Drill at $(Get-Date)..."
Write-Host "Source Repository: $PSScriptRoot\.."
Write-Host "Target Clone Path: $TargetDir"
Write-Host "=========================================================="

# 1. Clone repository into pristine temporary folder
Write-Host "[1/4] Cloning repository into isolated directory..."
git clone "$PSScriptRoot/.." "$TargetDir"

# 2. Verify all core files exist
Write-Host "[2/4] Verifying project skeleton in clean clone..."
$RequiredFiles = @(
    "deploy/docker-compose.yml",
    "backend/Dockerfile",
    "backend/package.json",
    "frontend/Dockerfile",
    "frontend/Caddyfile",
    "frontend/package.json",
    ".github/workflows/ci.yml",
    "README.md",
    "docs/architecture.md",
    "docs/runbook.md",
    "scripts/smoke-test.sh"
)

foreach ($file in $RequiredFiles) {
    $fullPath = Join-Path $TargetDir $file
    if (-not (Test-Path $fullPath)) {
        Write-Error "Missing critical project file in clean clone: $file"
        exit 1
    }
}
Write-Host "All core project files verified in clean clone!" -ForegroundColor Green

# 3. Validate Docker Compose configuration syntax
Write-Host "[3/4] Validating docker-compose syntax in clean clone..."
$ComposePath = Join-Path $TargetDir "deploy/docker-compose.yml"
docker compose -f $ComposePath config | Out-Null
Write-Host "Docker Compose configuration parsed cleanly!" -ForegroundColor Green

# 4. Clean up temporary directory
Write-Host "[4/4] Cleaning up temporary clone directory..."
Remove-Item -Recurse -Force $TargetDir
Write-Host "Clean-clone verification completed with 100% success!" -ForegroundColor Green
Write-Host "=========================================================="
