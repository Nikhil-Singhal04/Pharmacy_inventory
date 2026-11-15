# ====================================================================
# Pharmacy Inventory System — Automated Deployment Rollback (PowerShell)
# ====================================================================

param (
    [Parameter(Mandatory=$true, Position=0)]
    [string]$TargetTag
)

$ComposeFile = if ($env:COMPOSE_FILE) { $env:COMPOSE_FILE } else { "deploy/docker-compose.yml" }

Write-Host "=========================================================="
Write-Host "Initiating service rollback to image tag: $TargetTag"
Write-Host "Compose File: $ComposeFile"
Write-Host "Time:         $(Get-Date)"
Write-Host "=========================================================="

$env:IMAGE_TAG = $TargetTag

Write-Host "Recreating api and web services with target image tag..."
docker compose -f $ComposeFile up -d --no-build api web

Write-Host "Awaiting health check stabilization..."
for ($i = 1; $i -le 15; $i++) {
    $ApiStatus = docker inspect --format='{{.State.Health.Status}}' pharmacy_api 2>$null
    $WebStatus = docker inspect --format='{{.State.Health.Status}}' pharmacy_web 2>$null

    Write-Host "Checking status ($i/15): api is $ApiStatus, web is $WebStatus..."

    if ($ApiStatus -eq "healthy" -and $WebStatus -eq "healthy") {
        Write-Host "=========================================================="
        Write-Host "Rollback successful! Both services are verified healthy."
        Write-Host "Current stack status:"
        docker compose -f $ComposeFile ps
        Write-Host "=========================================================="
        exit 0
    }
    Start-Sleep -Seconds 2
}

Write-Error "Error: Services did not transition to healthy within expected timeframe."
docker compose -f $ComposeFile ps
exit 1
