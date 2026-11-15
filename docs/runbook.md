# Operational Runbook — Pharmacy Inventory Management System

This runbook provides step-by-step operational procedures, disaster recovery workflows, and incident response playbooks for system administrators and DevOps engineers operating the **Pharmacy Inventory Management System**.

---

## 1. Daily Operations & System Commands

### Starting the Service Stack
To spin up all services (`db`, `api`, `web`) with health checks and network isolation:
```bash
docker compose -f deploy/docker-compose.yml up -d
```
*(Or run `make up`)*

### Checking Service Health & Container Status
Inspect running containers, published ports, and live health check states:
```bash
docker compose -f deploy/docker-compose.yml ps
```
**Healthy Stack Output:**
```text
NAME           IMAGE                 COMMAND                  SERVICE   STATUS                    PORTS
pharmacy_api   pharmacy-api:latest   "./docker-entrypoint…"   api       Up 15 minutes (healthy)   3000/tcp
pharmacy_db    postgres:16-alpine    "docker-entrypoint.s…"   db        Up 15 minutes (healthy)   5432/tcp
pharmacy_web   pharmacy-web:latest   "caddy run --config …"   web       Up 15 minutes (healthy)   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### Stopping the Service Stack
To stop and remove containers and network (data persists safely in named volumes):
```bash
docker compose -f deploy/docker-compose.yml down
```
*(Or run `make down`)*

### Viewing & Filtering Structured Logs
Follow real-time JSON logs across all services:
```bash
# Follow all logs
docker compose -f deploy/docker-compose.yml logs -f

# Follow API service only
docker compose -f deploy/docker-compose.yml logs -f api

# Follow Web / Reverse Proxy only
docker compose -f deploy/docker-compose.yml logs -f web

# Inspect last 50 error entries
docker compose -f deploy/docker-compose.yml logs --tail 50 api | grep '"level":"error"'
```

---

## 2. Health & Observability Monitoring

### Liveness Probe (`/health`)
Verifies the Node.js event loop and HTTP server are responsive. Does not probe the database.
```bash
curl -k https://localhost/health
```
**Expected Response:** HTTP 200
```json
{"status":"ok","uptime":1234.56,"timestamp":"2026-11-15T12:00:00.000Z"}
```

### Readiness Probe (`/ready`)
Verifies end-to-end database connectivity via `SELECT 1`.
```bash
curl -k https://localhost/ready
```
**Expected Response:**
- When Database is Online: HTTP 200 with `{"status":"ready","database":"connected",...}`
- When Database is Offline: HTTP 503 with `{"status":"not_ready","database":"disconnected",...}`

### Prometheus Metrics (`/metrics`)
Extracts application runtime statistics and HTTP request duration histograms:
```bash
curl -k https://localhost/metrics
```

### Automated Smoke Test
Runs the end-to-end operational verification suite (liveness, readiness, valid transaction, expired sale rejection):
```bash
# Linux/macOS
./scripts/smoke-test.sh

# Windows PowerShell
.\scripts\smoke-test.ps1
```

---

## 3. Disaster Recovery: Backup & Restore

### Generating a Timestamped Database Backup
Executes a compressed PostgreSQL custom-format (`-Fc`) archive:
```bash
# Linux/macOS
./scripts/backup.sh

# Windows PowerShell
.\scripts\backup.ps1
```
Backups are stored in `backups/pharmacy_backup_<YYYYMMDD_HHMMSS>.dump`.

### Restoring from Backup
Restores database tables, sequences, and constraints:
```bash
# Linux/macOS
./scripts/restore.sh backups/pharmacy_backup_20261115_171134.dump

# Windows PowerShell
.\scripts\restore.ps1 backups\pharmacy_backup_20261115_171134.dump
```
The script automatically terminates active client connections, applies `pg_restore --clean --if-exists`, and outputs verified row counts.

---

## 4. Deployment Rollback Procedure

If a newly deployed image tag introduces errors or fails acceptance checks, roll back instantly to a known stable image tag:
```bash
# Linux/macOS
./scripts/rollback.sh <target_tag>
# Example: ./scripts/rollback.sh sha-b9e9dd4

# Windows PowerShell
.\scripts\rollback.ps1 <target_tag>
# Example: .\scripts\rollback.ps1 latest
```
The rollback script updates the image environment, recreates the application and web tiers, monitors health status, and confirms stabilization.

---

## 5. Incident Response Playbooks

---

### Incident Playbook 1: Database Outage / Readiness Failing (HTTP 503)

#### Symptoms
- Clients receiving HTTP 503 on API requests.
- Health probe `/health` returns 200, but `/ready` returns 503.
- Logs show `"msg":"Readiness probe failed: unable to connect to database"`.

#### Triage & Diagnostic Steps
1. Check database container status:
   ```bash
   docker compose -f deploy/docker-compose.yml ps db
   ```
2. Inspect database container logs:
   ```bash
   docker compose -f deploy/docker-compose.yml logs --tail 50 db
   ```
3. Check host disk space to ensure PostgreSQL data volume is not starved of storage:
   ```bash
   df -h /var/lib/docker
   ```

#### Resolution
1. Restart the database service:
   ```bash
   docker compose -f deploy/docker-compose.yml start db
   ```
2. Verify database health check passes:
   ```bash
   docker inspect --format='{{.State.Health.Status}}' pharmacy_db
   ```
3. Verify `/ready` returns HTTP 200:
   ```bash
   curl -k https://localhost/ready
   ```

---

### Incident Playbook 2: API Process Crash or Container Exit

#### Symptoms
- Requests to `https://localhost/api/*` return HTTP 502 Bad Gateway from Caddy.
- Container `pharmacy_api` reports restart count increasing or status `exited`.

#### Triage & Diagnostic Steps
1. Inspect container exit code and crash cause:
   ```bash
   docker inspect --format='ExitCode: {{.State.ExitCode}}, Error: {{.State.Error}}' pharmacy_api
   docker logs --tail 100 pharmacy_api
   ```
2. Common causes:
   - **Out of Memory (OOM):** Exit code 137 indicates the container was killed by the Linux kernel OOM killer.
   - **Unhandled Exception:** Inspect the logged stack trace.

#### Resolution
1. Under standard operation, Docker's `restart: unless-stopped` automatically restarts the container.
2. If the container failed to restart automatically, force recreate:
   ```bash
   docker compose -f deploy/docker-compose.yml up -d --force-recreate api
   ```
3. If caused by memory exhaustion, adjust resource limits or investigate memory leaks via Node heap profiles.

---

### Incident Playbook 3: Corrupt or Faulty Version Deployment

#### Symptoms
- Errors reported immediately after a new deployment or CI/CD tag push.
- Regression in domain business logic (e.g. sales failing, schema mismatch).

#### Resolution
1. Identify the previous stable Git commit SHA or GHCR image tag.
2. Run the rollback script immediately:
   ```bash
   ./scripts/rollback.sh <previous_tag>
   ```
3. Verify stack health using the automated smoke test:
   ```bash
   ./scripts/smoke-test.sh
   ```
4. If database schema was modified destructively, restore database from the pre-deployment backup:
   ```bash
   ./scripts/restore.sh backups/<pre_deploy_backup>.dump
   ```

---

### Incident Playbook 4: Database Migration Failure

#### Symptoms
- Container `pharmacy_api` fails on startup with `migration failed` in `docker logs pharmacy_api`.

#### Triage & Resolution
1. Check migration status:
   ```bash
   docker compose -f deploy/docker-compose.yml exec api npx node-pg-migrate status
   ```
2. Rollback the last failed migration:
   ```bash
   docker compose -f deploy/docker-compose.yml exec api npx node-pg-migrate down
   ```
3. Fix migration SQL in `backend/migrations/`, rebuild the image, and restart.
