# ====================================================================
# Pharmacy Inventory System — Automated Smoke Test Suite (PowerShell)
# ====================================================================

param (
    [string]$BaseUrl = "https://localhost"
)

Write-Host "=========================================================="
Write-Host "Starting Smoke Test Suite at $(Get-Date)..."
Write-Host "Target Base URL: $BaseUrl"
Write-Host "=========================================================="

# Bypass certificate validation for internal/self-signed certs
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

# 1. Probe Liveness Check (/health)
Write-Host -NoNewline "[1/4] Probing Liveness Endpoint (/health)... "
$HealthCode = curl.exe -k -s -o NUL -w "%{http_code}" "$BaseUrl/health"
if ($HealthCode -eq "200") {
    Write-Host "PASS (HTTP 200)" -ForegroundColor Green
} else {
    Write-Host "FAIL (HTTP $HealthCode)" -ForegroundColor Red
    exit 1
}

# 2. Probe Readiness Check (/ready)
Write-Host -NoNewline "[2/4] Probing Readiness Endpoint (/ready)... "
$ReadyCode = curl.exe -k -s -o NUL -w "%{http_code}" "$BaseUrl/ready"
if ($ReadyCode -eq "200") {
    Write-Host "PASS (HTTP 200)" -ForegroundColor Green
} else {
    Write-Host "FAIL (HTTP $ReadyCode)" -ForegroundColor Red
    exit 1
}

# 3. Test Valid Sale Transaction
Write-Host -NoNewline "[3/4] Testing Valid Sale Transaction... "
$SaleResult = node -e "
process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
fetch('$BaseUrl/api/stock-movements', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ batch_id: 1, type: 'SALE', quantity: 1, reason: 'Smoke test valid sale' })
}).then(r => console.log(r.status));
"
if ($SaleResult.Trim() -eq "201") {
    Write-Host "PASS (HTTP 201 Created)" -ForegroundColor Green
} else {
    Write-Host "FAIL (Expected HTTP 201, got $SaleResult)" -ForegroundColor Red
    exit 1
}

# 4. Test Acceptance A1: Expired Batch Sale Rejection
Write-Host -NoNewline "[4/4] Testing Expired Batch Sale Rejection (Acceptance A1)... "
$ExpResult = node -e "
process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
fetch('$BaseUrl/api/stock-movements', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ batch_id: 2, type: 'SALE', quantity: 1, reason: 'Smoke test expired sale' })
}).then(async r => {
  const b = await r.json();
  console.log(r.status + ':' + (b.error?.code || ''));
});
"
if ($ExpResult.Trim() -eq "400:BATCH_EXPIRED") {
    Write-Host "PASS (HTTP 400 with BATCH_EXPIRED)" -ForegroundColor Green
} else {
    Write-Host "FAIL (Expected 400:BATCH_EXPIRED, got $ExpResult)" -ForegroundColor Red
    exit 1
}

Write-Host "=========================================================="
Write-Host "All smoke tests passed successfully! Deployment verified."
Write-Host "=========================================================="
