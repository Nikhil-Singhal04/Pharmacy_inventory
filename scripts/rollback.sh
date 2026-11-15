#!/bin/sh
set -e

# ====================================================================
# Pharmacy Inventory System — Automated Deployment Rollback Script
# Redeploys services to a specified version tag (e.g., sha-<commit> or v1.0.0).
# ====================================================================

TARGET_TAG="$1"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.yml}"

if [ -z "$TARGET_TAG" ]; then
  echo "Usage: $0 <image_tag>"
  echo "Example: $0 sha-b9e9dd4"
  echo "Example: $0 latest"
  exit 1
fi

echo "=========================================================="
echo "Initiating service rollback to image tag: ${TARGET_TAG}"
echo "Compose File: ${COMPOSE_FILE}"
echo "Time:         $(date)"
echo "=========================================================="

export IMAGE_TAG="$TARGET_TAG"

echo "Recreating api and web services with target image tag..."
docker compose -f "$COMPOSE_FILE" up -d --no-build api web

echo "Awaiting health check stabilization..."
for i in $(seq 1 15); do
  API_STATUS=$(docker inspect --format='{{.State.Health.Status}}' pharmacy_api 2>/dev/null || echo "starting")
  WEB_STATUS=$(docker inspect --format='{{.State.Health.Status}}' pharmacy_web 2>/dev/null || echo "starting")
  
  echo "Checking status ($i/15): api is ${API_STATUS}, web is ${WEB_STATUS}..."
  
  if [ "$API_STATUS" = "healthy" ] && [ "$WEB_STATUS" = "healthy" ]; then
    echo "=========================================================="
    echo "Rollback successful! Both services are verified healthy."
    echo "Current stack status:"
    docker compose -f "$COMPOSE_FILE" ps
    echo "=========================================================="
    exit 0
  fi
  sleep 2
done

echo "Error: Services did not transition to healthy within expected timeframe."
docker compose -f "$COMPOSE_FILE" ps
exit 1
