Pharmacy Inventory API (PERN) — Cloud Deployment & CI/CD
> Algions AI Labs · DevOps & Cloud Engineering · Individual project assessment
> **Service:** Medicine, batch and stock-movement API (+ minimal React dashboard)
> **Stack:** PostgreSQL · Express · React · Node.js
> **Focus:** reproducible build, release, deployment, observability, recovery (not a full pharmacy/POS product)
---
1. Goal
Make a small pharmacy inventory service reproducibly buildable, deployable, observable and recoverable with production-style practices. The grading is mostly DevOps, so the React UI stays minimal (4 small screens at most).
Business rules the API must enforce
Reject negative/zero quantities and invalid batch data.
Reject sales from expired batches.
Reject sales with insufficient batch quantity (stock unchanged on failure).
Every purchase, sale, return and adjustment is an auditable stock movement.
Concurrent sales cannot oversell a batch.
Synthetic seed data, tests, and a simple report endpoint.
Acceptance tests (must be demonstrable)
#	Test	Evidence
A1	Sale on expired batch / insufficient qty fails, stock unchanged	Jest output
A2	Clean environment builds & starts from documented steps	README + clean-clone log
A3	CI runs checks/tests and produces a versioned image	Pipeline URL + image tag/digest
A4	Health/readiness + logs; stop/break a service → detect & recover	`docs/evidence/failure-recovery.md`
A5	Backup restored OR rollback demonstrated	`docs/evidence/backup-restore.md`
---
2. Tech stack
Concern	Choice
Backend	Node.js 22 LTS + Express 4/5 (plain JavaScript, ES modules)
DB	PostgreSQL 16, `pg` (node-postgres) with explicit transactions
Migrations	`node-pg-migrate`
Frontend	React 18 + Vite (minimal dashboard)
Tests	Jest/Vitest + Supertest against a real Postgres
Lint / format	ESLint + Prettier
Logging / metrics	`pino` + `pino-http` (JSON logs), `prom-client` (`/metrics`, stretch)
Containers	Multi-stage Dockerfiles (api, web), non-root, `node:22-alpine` pinned
Orchestration	Docker Compose: `db`, `api`, `web` (Caddy serving React build + proxying `/api`)
HTTPS	Caddy `tls internal` (local CA)
CI/CD	GitHub Actions → GHCR
Scanning	Trivy (image + fs), `npm audit`, gitleaks (optional)
---
3. Repository layout (target)
```
.
├── backend/
│   ├── src/ (app.js, server.js, config.js, db.js, logger.js, routes/, services/, middleware/)
│   ├── migrations/
│   ├── seeds/seed.js
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/ (React app)
│   ├── Caddyfile
│   ├── Dockerfile          # build with node, serve with caddy
│   └── package.json
├── deploy/
│   ├── docker-compose.yml
│   └── secrets/            # gitignored; only *.example committed
├── scripts/  backup.sh restore.sh rollback.sh smoke-test.sh seed.sh
├── .github/workflows/ci.yml
├── docs/ (architecture.md, runbook.md, evidence/)
├── .env.example  .gitignore  .dockerignore  Makefile
├── PROJECT_PHASES.md
└── README.md
```
---
4. Timeline (Fri 13 Nov → Sun 15 Nov evening)
When	Phases
Fri (today)	0 → 3
Sat	4 → 8
Sun (until ~4 PM)	9 → 12
Sun evening	Clean-clone check + submit
> Never start a phase until the previous phase's exit checks pass. Commit at the end of each phase.
---
5. Phases
Phase 0 — Repo bootstrap (~20 min)
Create repo + skeleton, `.gitignore` (`.env`, `deploy/secrets/`, `backups/`, `node_modules/`, `dist/`), `.dockerignore`, `.env.example`, `Makefile`.
Exit: no secrets tracked; `make help` works.
Phase 1 — Backend API core (~2–3 hrs)
Tables: `medicines`, `batches` (batch_no, expiry_date, quantity_on_hand CHECK ≥ 0, unique(medicine_id, batch_no)), `stock_movements` (type PURCHASE/SALE/RETURN/ADJUSTMENT, quantity, reason, reference, created_at).
Migrations via `node-pg-migrate`; seed script with synthetic data (incl. one expired and one low-stock batch).
Endpoints: `GET/POST /api/medicines`, `GET/POST /api/batches`, `POST /api/stock-movements`, `GET /api/stock-movements?batch_id=`, `GET /api/reports/stock-summary`.
Input validation (zod or manual), central error handler.
Exit: API runs locally, seed loads, endpoints respond via curl.
Phase 2 — Business rules, concurrency, tests (~2 hrs)
SALE in one transaction: `SELECT … FOR UPDATE` on the batch row (or atomic `UPDATE … WHERE quantity_on_hand >= $n`), reject if expired or insufficient, then update stock + insert movement. Rollback on any failure.
Tests: negative qty, invalid batch, expired sale, insufficient qty (assert stock unchanged and no movement row), return, adjustment, audit rows, concurrency (e.g. 20 parallel sales of 1 on a batch with 10 → exactly 10 succeed, stock = 0).
Exit: tests green; concurrency test passes 5 runs in a row.
Phase 3 — Health, readiness, logging (~1 hr)
`/health` (liveness, no DB), `/ready` (DB `SELECT 1`, 503 when down).
`pino` JSON logs with request ID, method, path, status, latency; `LOG_LEVEL` env.
Optional `/metrics`.
Exit: stop Postgres → `/ready` 503, `/health` 200; logs are JSON.
Phase 4 — Minimal React frontend (~1.5 hrs)
Vite + React: medicines list/add, batches list/add (expiry highlighted), record movement form (shows API error clearly), stock summary report.
Calls `/api/...` (relative URL, so it works behind the proxy).
Exit: UI works locally against API (Vite dev proxy); a rejected sale shows the error message.
Keep it ugly-but-working. Do not spend more than 1.5 hrs.
Phase 5 — Containerization (~1.5 hrs)
`backend/Dockerfile`: multi-stage, pinned `node:22-alpine`, `npm ci --omit=dev`, non-root `node` user, `HEALTHCHECK`, version/SHA build args.
`frontend/Dockerfile`: node build stage → Caddy image serving `dist/`.
Exit: both images build; `docker run` shows non-root (`id`), healthy.
Phase 6 — Compose + reverse proxy + HTTPS (~2 hrs)
Services: `db` (named volume, healthcheck), `api` (depends_on db healthy, runs migrations on start or a `migrate` one-shot, `restart: unless-stopped`), `web` (Caddy: serves React, proxies `/api/*` → `api:3000`, HTTP→HTTPS, security headers).
DB and API not published to host; only `web` exposes 80/443. Secrets via env / Docker secrets.
Exit: `docker compose up -d --build` from clean clone → all healthy; `https://localhost` loads UI; data persists across `down`/`up`.
Phase 7 — CI pipeline (~2 hrs)
`.github/workflows/ci.yml` on push + PR: checkout → setup-node (cache) → `npm ci` → ESLint + Prettier check (backend & frontend) → tests (Postgres service container) → frontend build → docker buildx build → Trivy scan → push to GHCR on `main`/tags.
Tags: `sha-<short>`, `vX.Y.Z` on git tags, `latest` from main only; print digest.
Minimal `permissions:`, no secrets in repo.
Exit: green run; images in GHCR; save run URL + digest.
Phase 8 — Security hardening (~1 hr)
Env-only config, `.env.example` placeholders, least-privilege DB app user, non-root, `read_only` fs/`cap_drop` where feasible, Helmet + rate limit on API, `npm audit`, Trivy report saved.
Exit: `git grep -i password` shows only placeholders; scan output in `docs/evidence/`.
Phase 9 — Backup, restore, rollback (~2 hrs)
`backup.sh` (`pg_dump -Fc` via `docker compose exec db`, timestamped), `restore.sh`, `rollback.sh <tag>` (redeploy previous GHCR tag).
Drill: seed → backup → delete data → restore → counts match. Rollback: tag N → N-1 → healthy.
Exit: `docs/evidence/backup-restore.md` with commands, outputs, before/after counts.
Phase 10 — Failure & recovery drills (~1 hr)
Drill 1: stop `db` → `/ready` 503 + error logs → start → auto recovery.
Drill 2: kill `api` → restart policy recovers.
`scripts/smoke-test.sh`: health + valid sale + expired-sale rejection.
Exit: `docs/evidence/failure-recovery.md` with timestamps/logs.
Phase 11 — Documentation (~2–3 hrs)
`README.md`: overview, prerequisites, quick start, env var table, port map, API summary, tests, deploy, rollback, limitations.
`docs/architecture.md` with Mermaid diagram (export PNG/SVG).
`docs/runbook.md`: deploy, restart, logs, backup/restore, rollback, incident response (DB down, API crash, disk full, bad deploy).
Exit: every acceptance test A1–A5 has evidence.
Phase 12 — Clean-clone verification (~1 hr)
Fresh clone in a new folder → follow README only → fix gaps.
Exit: works with zero undocumented steps.
---
6. Manual tasks (you do these)
[ ] Push to GitHub, enable Actions, make GHCR package accessible
[ ] Screenshot green pipeline + copy run URL
[ ] Copy image tag + digest
[ ] Screenshots: `/ready`, logs, `docker compose ps`, failure/recovery, restore
[ ] Record 3–5 min demo: pipeline → HTTPS deployed service → health/logs → failure/recovery or restore
[ ] Fill submission form (name, reg no., email, repo URL, branch, final commit ID, video link, AI-tool declaration)
[ ] Check all links in incognito
[ ] Be able to explain every file in the live walkthrough
7. Final submission checklist
[ ] Source, Dockerfiles, Compose, CI workflow, deployment config
[ ] README (build/run/deploy, env vars, port map, rollback)
[ ] Architecture diagram + runbook
[ ] Pipeline run URL/screenshot, image tag/digest
[ ] Deployment/health evidence
[ ] Backup/restore evidence
[ ] Domain-rule test output
[ ] 3–5 min demo video
[ ] No `.env`, passwords, tokens, keys committed
[ ] AI-tool usage declared; known limitations stated
8. Rubric map (100 marks)
Criterion	Marks	Phases
Containerization & reproducibility	20	5, 6
CI/CD automation	20	7
Deployment, networking & security	15	6, 8
Observability & troubleshooting	15	3, 10
Backup, restore & rollback	15	9
Reliability & documentation	10	11, 12
Domain API correctness	5	1, 2
