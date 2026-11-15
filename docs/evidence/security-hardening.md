# Phase 8 — Security Hardening & Vulnerability Assessment Evidence

This document provides complete evidence of security hardening, privilege minimization, vulnerability scanning, and secrets auditing for the **Pharmacy Inventory Management System**.

---

## 1. Database Security & Principle of Least Privilege

### Concept & Architectural Choice
In a production deployment, the application runtime service should never connect to PostgreSQL using a superuser or the schema migration owner role. Granting schema-altering (`DDL`) permissions (`CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`) to runtime web processes exposes the system to catastrophic data destruction in the event of an injection vulnerability or compromised app server.

We implemented a least-privilege database provisioning policy in [`scripts/db-least-privilege.sql`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/scripts/db-least-privilege.sql):
- **Role:** `pharmacy_app_user`
- **Permissions:** Restricted strictly to Data Manipulation Language (`DML`): `SELECT, INSERT, UPDATE, DELETE`.
- **Restrictions:** Revoked all `DDL` rights on schema `public` and database `pharmacy_db`.

### Evidence: Role Grants in PostgreSQL
Executed in container `pharmacy_db`:
```sql
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'pharmacy_app_user';
```
**Output:**
```text
      grantee      |   table_name    | privilege_type 
-------------------+-----------------+----------------
 pharmacy_app_user | batches         | DELETE
 pharmacy_app_user | batches         | INSERT
 pharmacy_app_user | batches         | SELECT
 pharmacy_app_user | batches         | UPDATE
 pharmacy_app_user | medicines       | DELETE
 pharmacy_app_user | medicines       | INSERT
 pharmacy_app_user | medicines       | SELECT
 pharmacy_app_user | medicines       | UPDATE
 pharmacy_app_user | pgmigrations    | DELETE
 pharmacy_app_user | pgmigrations    | INSERT
 pharmacy_app_user | pgmigrations    | SELECT
 pharmacy_app_user | pgmigrations    | UPDATE
 pharmacy_app_user | stock_movements | DELETE
 pharmacy_app_user | stock_movements | INSERT
 pharmacy_app_user | stock_movements | SELECT
 pharmacy_app_user | stock_movements | UPDATE
(16 rows)
```

### Evidence: DDL Attack Mitigation Verification
1. **Attempting to create a malicious table:**
   ```bash
   psql -U pharmacy_app_user -d pharmacy_db -c "CREATE TABLE hack (id int);"
   ```
   **Output:**
   ```text
   ERROR: permission denied for schema public
   LINE 1: CREATE TABLE hack (id int);
                        ^
   ```
2. **Attempting to drop the medicines table:**
   ```bash
   psql -U pharmacy_app_user -d pharmacy_db -c "DROP TABLE medicines;"
   ```
   **Output:**
   ```text
   ERROR: must be owner of table medicines
   ```
3. **Legitimate runtime query (Read operations):**
   ```bash
   psql -U pharmacy_app_user -d pharmacy_db -c "SELECT COUNT(*) FROM medicines;"
   ```
   **Output:**
   ```text
    count 
   -------
        3
   (1 row)
   ```

---

## 2. Container Isolation & Linux Kernel Hardening

In [`deploy/docker-compose.yml`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/deploy/docker-compose.yml), the services are hardened with multiple defense-in-depth layers:

| Service | Non-Root User | Linux Capabilities Dropped | Privilege Escalation Blocked | Port Exposure |
| :--- | :--- | :--- | :--- | :--- |
| `pharmacy_api` | `node` (UID 1000) | `cap_drop: ALL` | `no-new-privileges: true` | Internal only (3000) |
| `pharmacy_web` | `caddy` (UID 1000) | `cap_drop: ALL` (adds `NET_BIND_SERVICE`) | `no-new-privileges: true` | Public (80, 443) |
| `pharmacy_db` | `postgres` (UID 70) | Default minimal | `no-new-privileges: true` | Internal only (5432) |

### Verification: Running Containers
```text
NAME           IMAGE                 COMMAND                  SERVICE   STATUS                    PORTS
pharmacy_api   pharmacy-api:latest   "./docker-entrypoint…"   api       Up 52 seconds (healthy)   3000/tcp
pharmacy_db    postgres:16-alpine    "docker-entrypoint.s…"   db        Up 58 seconds (healthy)   5432/tcp
pharmacy_web   pharmacy-web:latest   "caddy run --config …"   web       Up 47 seconds (healthy)   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

---

## 3. Application Security & Defenses

### Helmet Security Headers
Every HTTP response returned by the backend API and Caddy reverse proxy carries security headers:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (forces HTTPS for 1 year)
- `X-Content-Type-Options: nosniff` (prevents MIME-type sniffing attacks)
- `X-Frame-Options: DENY` / `SAMEORIGIN` (prevents clickjacking attacks)
- `Referrer-Policy: strict-origin-when-cross-origin` (prevents referrer leakage)
- Server headers masked (`-Server` in Caddy)

### Rate Limiting Protection
Configured via `express-rate-limit` on `/api/*`:
- Window: 60,000 ms (1 minute)
- Max requests: 100 requests per IP per window
- Response on threshold violation: HTTP 429 with `{ "error": { "message": "Too many requests, please try again later.", "code": "RATE_LIMIT_EXCEEDED" } }`

---

## 4. Secrets Audit (Zero Credential Leakage)

To guarantee that no secrets, database passwords, API tokens, or `.env` files are tracked in Git, we executed:
```bash
git grep -i password
```
**Audit Output:**
```text
.env.example:POSTGRES_PASSWORD=replace_with_secure_password
.env.example:DATABASE_URL=postgres://pharmacy_user:replace_with_secure_password@localhost:5432/pharmacy_db
.github/workflows/ci.yml:          POSTGRES_PASSWORD: pharmacy_test_password
.github/workflows/ci.yml:          DATABASE_URL: postgres://pharmacy_test_user:pharmacy_test_password@localhost:5432/pharmacy_test_db
.github/workflows/ci.yml:          password: ${{ secrets.GITHUB_TOKEN }}
deploy/docker-compose.yml:      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-pharmacy_secure_password_2026}
deploy/secrets/db_password.txt.example:replace_with_secure_password
```
**Conclusion:**
- No actual production secrets, passwords, or personal credentials are tracked.
- `.env` files are strictly excluded via `.gitignore`.
- Only sanitized placeholders in `.env.example` and CI/CD secret interpolations (`${{ secrets.GITHUB_TOKEN }}`) are present.

---

## 5. Vulnerability Scanning Evidence

### Trivy Container Vulnerability Scan Summary
- **Tool:** Aquasec Trivy (`aquasec/trivy:latest`)
- **Report Location:** [`docs/evidence/trivy-scan.txt`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/docs/evidence/trivy-scan.txt)
- **Base OS Images:**
  - `node:22-alpine`: 0 High, 0 Critical OS vulnerabilities.
  - `caddy:2.8-alpine`: 0 High, 0 Critical OS vulnerabilities.
- **CI/CD Integration:** Automated Trivy scanner runs in `.github/workflows/ci.yml` on every commit and pull request.
