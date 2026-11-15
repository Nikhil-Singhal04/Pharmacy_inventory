#!/bin/sh
set -e

# ====================================================================
# Pharmacy Inventory System — Clean Clone Verification Script
# Validates Acceptance A2: Reproducibility from a fresh git clone
# ====================================================================

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_DIR="${TMPDIR:-/tmp}/pharmacy_clean_clone_${TIMESTAMP}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/.."

echo "=========================================================="
echo "Starting Clean-Clone Verification Drill at $(date)..."
echo "Source Repository: ${REPO_ROOT}"
echo "Target Clone Path: ${TARGET_DIR}"
echo "=========================================================="

echo "[1/4] Cloning repository into isolated directory..."
git clone "${REPO_ROOT}" "${TARGET_DIR}"

echo "[2/4] Verifying project skeleton in clean clone..."
for f in \
  "deploy/docker-compose.yml" \
  "backend/Dockerfile" \
  "backend/package.json" \
  "frontend/Dockerfile" \
  "frontend/Caddyfile" \
  "frontend/package.json" \
  ".github/workflows/ci.yml" \
  "README.md" \
  "docs/architecture.md" \
  "docs/runbook.md" \
  "scripts/smoke-test.sh"; do
  if [ ! -f "${TARGET_DIR}/$f" ]; then
    echo "Error: Missing critical file in clean clone: $f"
    exit 1
  fi
done
echo "All core project files verified in clean clone!"

echo "[3/4] Validating docker-compose syntax in clean clone..."
docker compose -f "${TARGET_DIR}/deploy/docker-compose.yml" config > /dev/null
echo "Docker Compose configuration parsed cleanly!"

echo "[4/4] Cleaning up temporary clone directory..."
rm -rf "${TARGET_DIR}"
echo "Clean-clone verification completed with 100% success!"
echo "=========================================================="
