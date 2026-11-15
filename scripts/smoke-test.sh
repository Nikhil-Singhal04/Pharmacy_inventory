#!/bin/sh
set -e

# ====================================================================
# Pharmacy Inventory System — Automated Smoke Test Suite
# Validates liveness, readiness, valid business transactions,
# and expired batch sale rejections against the live HTTPS deployment.
# ====================================================================

BASE_URL="${BASE_URL:-https://localhost}"

echo "=========================================================="
echo "Starting Smoke Test Suite at $(date)..."
echo "Target Base URL: ${BASE_URL}"
echo "=========================================================="

# 1. Probe Liveness Check (/health)
echo -n "[1/4] Probing Liveness Endpoint (/health)... "
HEALTH_RESP=$(curl -k -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
if [ "$HEALTH_RESP" = "200" ]; then
  echo "PASS (HTTP 200)"
else
  echo "FAIL (HTTP $HEALTH_RESP)"
  exit 1
fi

# 2. Probe Readiness Check (/ready)
echo -n "[2/4] Probing Readiness Endpoint (/ready)... "
READY_RESP=$(curl -k -s -o /dev/null -w "%{http_code}" "${BASE_URL}/ready")
if [ "$READY_RESP" = "200" ]; then
  echo "PASS (HTTP 200)"
else
  echo "FAIL (HTTP $READY_RESP)"
  exit 1
fi

# 3. Test Valid Sale Execution (Active Batch)
echo -n "[3/4] Testing Valid Sale Transaction... "
SALE_RESP=$(curl -k -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/stock-movements" \
  -H "Content-Type: application/json" \
  -d '{"batch_id":1,"type":"SALE","quantity":1,"reason":"Smoke test valid sale"}')

SALE_BODY=$(echo "$SALE_RESP" | head -n 1)
SALE_CODE=$(echo "$SALE_RESP" | tail -n 1)

if [ "$SALE_CODE" = "201" ]; then
  echo "PASS (HTTP 201 Created)"
else
  echo "FAIL (HTTP $SALE_CODE - $SALE_BODY)"
  exit 1
fi

# 4. Test Acceptance A1: Rejection of Expired Batch Sale (Batch 2: AMOX-2024EXP)
echo -n "[4/4] Testing Expired Batch Sale Rejection (Acceptance A1)... "
EXP_RESP=$(curl -k -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/stock-movements" \
  -H "Content-Type: application/json" \
  -d '{"batch_id":2,"type":"SALE","quantity":1,"reason":"Smoke test expired sale"}')

EXP_BODY=$(echo "$EXP_RESP" | head -n 1)
EXP_CODE=$(echo "$EXP_RESP" | tail -n 1)

if [ "$EXP_CODE" = "400" ] && echo "$EXP_BODY" | grep -q "BATCH_EXPIRED"; then
  echo "PASS (HTTP 400 with BATCH_EXPIRED)"
else
  echo "FAIL (Expected HTTP 400 BATCH_EXPIRED, got HTTP $EXP_CODE - $EXP_BODY)"
  exit 1
fi

echo "=========================================================="
echo "All smoke tests passed successfully! Deployment verified."
echo "=========================================================="
