# Final Assessment Submission Checklist & Walkthrough Guide

This document summarizes the final deliverables, verification evidence, and walkthrough notes for the **Pharmacy Inventory Management System** (DevOps & Cloud Engineering Assessment).

---

## 1. Submission Metadata Reference

| Field | Value |
| :--- | :--- |
| **Repository URL** | `https://github.com/Nikhil-Singhal04/Pharmacy_inventory` |
| **Active Branch** | `main` |
| **Container Registry** | `ghcr.io/nikhil-singhal04/pharmacy-api`, `ghcr.io/nikhil-singhal04/pharmacy-web` |
| **CI/CD Pipeline** | GitHub Actions (`.github/workflows/ci.yml`) — 100% Green |

---

## 2. Core Acceptance Criteria Checklist (100% Complete)

| Acceptance Test | Requirement | Evidence Location | Status |
| :--- | :--- | :--- | :--- |
| **A1** | Sale on expired batch fails; insufficient quantity fails; stock strictly unchanged; concurrency-safe. | [`docs/evidence/failure-recovery.md`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/docs/evidence/failure-recovery.md) | **PASS** |
| **A2** | Clean environment builds and starts from documented steps with zero undocumented manual interventions. | [`docs/evidence/clean-clone-verification.md`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/docs/evidence/clean-clone-verification.md) | **PASS** |
| **A3** | CI runs checks/tests, builds multi-stage containers, scans with Trivy, and produces versioned images on GHCR. | [GitHub Actions Workflow Summary](https://github.com/Nikhil-Singhal04/Pharmacy_inventory/actions) | **PASS** |
| **A4** | Decoupled `/health` and `/ready` probes; structured JSON logs; automatic self-healing on failure. | [`docs/evidence/failure-recovery.md`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/docs/evidence/failure-recovery.md) | **PASS** |
| **A5** | Disaster recovery: automated backup, restore verification, and deployment rollback demonstrated. | [`docs/evidence/backup-restore.md`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/docs/evidence/backup-restore.md) | **PASS** |

---

## 3. Rubric Marks Mapping (100 / 100)

| Criterion | Marks | Phases | Implementation Summary |
| :--- | :---: | :---: | :--- |
| **Containerization & Reproducibility** | 20 | 5, 6 | Multi-stage Dockerfiles (`node:22-alpine`, `caddy:2.8-alpine`), rootless users (`node:1000`, `caddy:1000`), Docker Compose with isolated network. |
| **CI/CD Automation** | 20 | 7 | GitHub Actions pipeline with Node caching, PostgreSQL service container, Trivy scan (`aquasecurity/trivy-action@v0.36.0`), and GHCR multi-tag publishing. |
| **Deployment, Networking & Security** | 15 | 6, 8 | Caddy reverse proxy with internal TLS, HTTP->HTTPS redirect, security headers, `cap_drop: ALL`, and PostgreSQL least-privilege role (`scripts/db-least-privilege.sql`). |
| **Observability & Troubleshooting** | 15 | 3, 10 | Decoupled `/health` (liveness) vs `/ready` (readiness), Pino structured JSON access/error logs, Prometheus metrics (`/metrics`). |
| **Backup, Restore & Rollback** | 15 | 9 | `scripts/backup.sh`, `scripts/restore.sh`, `scripts/rollback.sh`, with end-to-end disaster drill verifying identical before/after row counts. |
| **Reliability & Documentation** | 10 | 11, 12 | Comprehensive `README.md`, Mermaid architecture diagrams in `docs/architecture.md`, operational runbook in `docs/runbook.md`, clean-clone verification. |
| **Domain API Correctness** | 5 | 1, 2 | Pessimistic row locking (`SELECT ... FOR UPDATE`), 17/17 passing tests, 20-thread concurrency test with zero overselling. |

---

## 4. Suggested 3–5 Minute Demo Video Outline

When recording your demo video, follow this structured narrative:

1. **Introduction & Architecture (45 seconds):**
   - Show `deploy/docker-compose.yml` and `docs/architecture.md`.
   - Explain the 3-tier architecture: Caddy reverse proxy at the edge, unexposed internal Node API, and PostgreSQL database with persistent volume.
2. **CI/CD Pipeline on GitHub Actions (45 seconds):**
   - Open GitHub Actions in browser.
   - Show the 100% green pipeline with 4 jobs: Lint/Format, Backend Test Suite (Postgres container), Frontend Build, Container Build + Trivy Scan + GHCR Push.
   - Show the published packages on GitHub Container Registry (GHCR).
3. **Live Application & Concurrency / Business Rules (60 seconds):**
   - Open `https://localhost` in browser. Show medicines, batches, and movements.
   - Execute a sale on an expired batch (`AMOX-2024EXP`): show the red error banner displaying `BATCH_EXPIRED` and explain that stock remains untouched.
   - Run `npm test` in the terminal to show 17/17 tests passing (highlighting the 20-thread concurrency test).
4. **Observability & Failure Detection Drill (45 seconds):**
   - Open two terminal panes.
   - Pane 1: curl `https://localhost/health` (200 OK) and `https://localhost/ready` (200 OK).
   - Stop database: `docker compose -f deploy/docker-compose.yml stop db`.
   - Re-probe: show `/health` stays 200 (liveness) while `/ready` drops to 503 (readiness).
   - Show structured Pino JSON error log in `docker logs pharmacy_api`.
   - Start database: `docker compose -f deploy/docker-compose.yml start db`. Show `/ready` recovers to 200 immediately.
5. **Disaster Recovery & Rollback (45 seconds):**
   - Run `./scripts/backup.sh` to generate a dump.
   - Wipe data: `DELETE FROM stock_movements; DELETE FROM batches; DELETE FROM medicines;`.
   - Show tables empty (0 rows).
   - Run `./scripts/restore.sh <dump_file>`. Show row counts restored to 3 medicines, 5 batches, 5 movements.
   - Show `./scripts/rollback.sh latest` redeploying and verifying healthy services.

---

## 5. Walkthrough & Viva Guide (Key File Explanations)

| File | Core Technical Justification for Walkthrough |
| :--- | :--- |
| `backend/src/routes/stockMovements.js` | Uses `SELECT ... FOR UPDATE` inside a database transaction to acquire pessimistic row locks. This prevents race conditions and overselling when concurrent requests arrive simultaneously. |
| `backend/Dockerfile` | Multi-stage build (`builder` -> `runner`). Copies only production dependencies via `npm ci --omit=dev`. Sets `USER node` (UID 1000) for rootless execution. Pins base image to `node:22-alpine`. |
| `frontend/Caddyfile` | Serves static React assets, issues internal TLS certs, proxies `/api/*` to `api:3000`, forces HTTPS via 301 redirects on port 80, and injects HSTS, nosniff, and frame denial headers. |
| `deploy/docker-compose.yml` | Connects services via internal `pharmacy_network`. Only Caddy publishes ports 80/443. Enforces `security_opt: [no-new-privileges:true]` and drops all Linux capabilities (`cap_drop: ALL`). |
| `.github/workflows/ci.yml` | Automates end-to-end delivery. Runs ephemeral PostgreSQL service container for tests, scans containers using Aquasec Trivy (`@v0.36.0`), and pushes immutable images to GHCR. |
| `scripts/backup.sh` & `restore.sh` | Uses PostgreSQL custom format (`-Fc`). Terminates active sessions before restoration and asserts before/after table row counts match identically. |
| `scripts/db-least-privilege.sql` | Provisions dedicated runtime application role `pharmacy_app_user` with DML-only rights (`SELECT, INSERT, UPDATE, DELETE`) while explicitly disallowing DDL (`DROP, CREATE, ALTER`). |
