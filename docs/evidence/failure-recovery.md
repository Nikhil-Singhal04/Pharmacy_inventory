# Phase 10 — Observability, Failure Detection & Self-Healing Drills Evidence

This document provides complete evidence of failure detection, observability (structured logging, metrics, readiness probes), and automated recovery (Acceptance Test **A4**) for the **Pharmacy Inventory Management System**.

---

## 1. Automated Smoke Test Verification

Executed live deployment smoke test suite via [`scripts/smoke-test.sh`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/scripts/smoke-test.sh) / [`scripts/smoke-test.ps1`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/scripts/smoke-test.ps1):
```bash
./scripts/smoke-test.ps1
```

### Terminal Output
```text
==========================================================
Starting Smoke Test Suite at 11/15/2026 17:26:17...
Target Base URL: https://localhost
==========================================================
[1/4] Probing Liveness Endpoint (/health)... PASS (HTTP 200)
[2/4] Probing Readiness Endpoint (/ready)... PASS (HTTP 200)
[3/4] Testing Valid Sale Transaction... PASS (HTTP 201 Created)
[4/4] Testing Expired Batch Sale Rejection (Acceptance A1)... PASS (HTTP 400 with BATCH_EXPIRED)
==========================================================
All smoke tests passed successfully! Deployment verified.
==========================================================
```

---

## 2. Drill 1 — Database Failure Detection & Automatic Recovery

### Objective
Demonstrate that:
1. The **liveness probe** (`/health`) remains HTTP 200 during database outages (the Node.js process is alive and should not be unnecessarily killed).
2. The **readiness probe** (`/ready`) immediately detects database unavailability and returns HTTP 503, signaling ingress routers / load balancers to stop routing traffic to the API.
3. Structured JSON logs accurately record the database outage with full error context.
4. When PostgreSQL returns online, `/ready` automatically recovers to HTTP 200 without requiring container restarts or human intervention.

### Step-by-Step Execution & Log Transcripts

#### 1. Baseline Verification (Database Online)
```bash
curl -k -s https://localhost/health
curl -k -s https://localhost/ready
```
**Response:**
```json
{"status":"ok","uptime":4028.74,"timestamp":"2026-11-15T11:56:29.062Z"} [HTTP 200]
{"status":"ready","database":"connected","timestamp":"2026-11-15T11:56:29.207Z"} [HTTP 200]
```

#### 2. Trigger Outage: Stopping PostgreSQL Container
```bash
docker compose -f deploy/docker-compose.yml stop db
```
**Output:**
```text
Container pharmacy_db Stopping
Container pharmacy_db Stopped
```

#### 3. Probing Probes During Outage
```bash
curl -k -s https://localhost/health
curl -k -s https://localhost/ready
```
**Response:**
```text
# Liveness probe remains healthy:
{"status":"ok","uptime":4042.54,"timestamp":"2026-11-15T11:56:42.861Z"} [HTTP 200]

# Readiness probe flags dependency failure:
{"status":"not_ready","database":"disconnected","error":"Connection terminated due to connection timeout","timestamp":"2026-11-15T11:56:47.998Z"} [HTTP 503]
```

#### 4. Structured JSON Error Logs Captured from API Container
Extracted via `docker logs --tail 4 pharmacy_api`:
```json
{
  "level": "error",
  "time": "2026-11-15T11:56:47.995Z",
  "pid": 1,
  "hostname": "ef1a948d8e3b",
  "err": {
    "type": "Error",
    "message": "Connection terminated due to connection timeout: Connection terminated unexpectedly",
    "stack": "Error: Connection terminated due to connection timeout\n    at /app/node_modules/pg-pool/index.js:45:11\n    at async checkHealth (file:///app/src/db.js:45:18)\n    at async file:///app/src/routes/health.js:26:5"
  },
  "msg": "Readiness probe failed: unable to connect to database"
}
{
  "level": "error",
  "time": "2026-11-15T11:56:48.001Z",
  "pid": 1,
  "hostname": "ef1a948d8e3b",
  "req": {
    "id": "8d762cd7-eb7a-4839-a021-88251ce5b923",
    "method": "GET",
    "url": "/ready"
  },
  "res": {
    "statusCode": 503
  },
  "responseTime": 5006,
  "msg": "GET /ready -> 503: failed with status code 503"
}
```

#### 5. Recovery: Starting Database Container
```bash
docker compose -f deploy/docker-compose.yml start db
```
**Output:**
```text
Container pharmacy_db Starting
Container pharmacy_db Started
```

#### 6. Automatic Recovery Verification
```bash
curl -k -s https://localhost/ready
```
**Response:**
```json
{"status":"ready","database":"connected","timestamp":"2026-11-15T11:57:36.668Z"} [HTTP 200 OK]
```
The application connection pool re-established communication immediately and `/ready` returned to HTTP 200 without restart.

---

## 3. Drill 2 — API Process Crash & Docker Self-Healing

### Objective
Demonstrate that if the application server process crashes unexpectedly, Docker's container restart policy (`restart: unless-stopped`) automatically resurrects the service and returns it to a verified healthy state.

### Step-by-Step Execution

#### 1. Pre-Crash Baseline Status
```bash
docker inspect --format='{{.State.Status}} (PID {{.State.Pid}}, Health: {{.State.Health.Status}})' pharmacy_api
```
**Output:**
```text
running (PID 54210, Health: healthy)
```

#### 2. Simulating Process Crash
Terminated PID 1 inside the container:
```bash
docker compose -f deploy/docker-compose.yml exec -T api kill -TERM 1
```

#### 3. Automatic Recovery by Docker Engine
Docker detected unexpected process termination and restarted the container:
```bash
docker inspect --format='{{.State.Status}} (PID {{.State.Pid}}, RestartCount: {{.RestartCount}})' pharmacy_api
```
**Output:**
```text
running (PID 54786, RestartCount: 1)
```

#### 4. Post-Recovery Health Verification
```bash
docker compose -f deploy/docker-compose.yml ps
```
**Output:**
```text
NAME           IMAGE                 COMMAND                  SERVICE   STATUS                        PORTS
pharmacy_api   pharmacy-api:latest   "./docker-entrypoint…"   api       Up About a minute (healthy)   3000/tcp
pharmacy_db    postgres:16-alpine    "docker-entrypoint.s…"   db        Up 22 minutes (healthy)       5432/tcp
pharmacy_web   pharmacy-web:latest   "caddy run --config …"   web       Up 4 hours (healthy)          0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```
The API container automatically restarted, completed pending migration verification, started Node.js, and resumed passing internal Docker healthchecks.
