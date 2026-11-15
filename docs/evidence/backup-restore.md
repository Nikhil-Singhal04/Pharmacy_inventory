# Phase 9 — Disaster Recovery: Backup, Restore & Rollback Drill Evidence

This document provides complete proof of disaster recovery readiness (Acceptance Test **A5**) for the **Pharmacy Inventory Management System**.

---

## 1. Automated Backup Execution

### Command
Executed automated database backup via [`scripts/backup.sh`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/scripts/backup.sh) (and Windows equivalent [`scripts/backup.ps1`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/scripts/backup.ps1)):
```bash
./scripts/backup.sh
```

### Real Terminal Output
```text
==========================================================
Starting database backup at 11/15/2026 17:11:34...
Target Container Service: db
Database Name:            pharmacy_db
Backup Output:            backups\pharmacy_backup_20261115_171134.dump
==========================================================
Backup completed successfully!
Backup file: backups\pharmacy_backup_20261115_171134.dump (Size: 16006 bytes)
```

---

## 2. Disaster Simulation Drill (Data Deletion)

### 1. Pre-Disaster Row Counts
```sql
SELECT 'medicines' AS table_name, count(*) AS count FROM medicines 
UNION ALL 
SELECT 'batches', count(*) FROM batches 
UNION ALL 
SELECT 'stock_movements', count(*) FROM stock_movements;
```
**Output:**
```text
   table_name    | count 
-----------------+-------
 medicines       |     3
 batches         |     5
 stock_movements |     5
(3 rows)
```

### 2. Simulating Catastrophic Loss
Deleted all records across tables in reverse dependency order:
```bash
docker compose -f deploy/docker-compose.yml exec -T db psql -U pharmacy_user -d pharmacy_db -c \
  "DELETE FROM stock_movements; DELETE FROM batches; DELETE FROM medicines;"
```
**Output:**
```text
DELETE 5
DELETE 5
DELETE 3
```

### 3. Verification of Data Loss
```text
   table_name    | count 
-----------------+-------
 medicines       |     0
 batches         |     0
 stock_movements |     0
(3 rows)
```

---

## 3. Database Restoration Execution

### Command
Executed automated database restoration via [`scripts/restore.sh`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/scripts/restore.sh) (and Windows equivalent [`scripts/restore.ps1`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/scripts/restore.ps1)):
```bash
./scripts/restore.sh backups/pharmacy_backup_20261115_171134.dump
```

### Real Terminal Output
```text
==========================================================
Starting database restoration at 11/15/2026 17:12:50...
Target Container Service: db
Database Name:            pharmacy_db
Source Backup File:       backups\pharmacy_backup_20261115_171134.dump
==========================================================
Terminating active connections on pharmacy_db...
Restoring database objects and data from backups\pharmacy_backup_20261115_171134.dump...
Restoration complete. Verifying table row counts...
   table_name    | row_count 
-----------------+-----------
 medicines       |         3
 batches         |         5
 stock_movements |         5
(3 rows)
```

### 4. Post-Restoration Application API Verification
Probed `https://localhost/api/medicines`:
```bash
GET /api/medicines -> 200 OK
RESTORED MEDICINES: [ 'Amoxicillin 500mg', 'Ibuprofen 400mg', 'Paracetamol 650mg' ]
```

---

## 4. Automated Service Rollback Verification

Executed deployment rollback via [`scripts/rollback.sh`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/scripts/rollback.sh) (and [`scripts/rollback.ps1`](file:///c:/Users/nikhi/OneDrive/Desktop/Pharmacy_inventory/scripts/rollback.ps1)):
```bash
./scripts/rollback.sh latest
```

### Real Terminal Output
```text
==========================================================
Initiating service rollback to image tag: latest
Compose File: deploy/docker-compose.yml
Time:         11/15/2026 17:13:50
==========================================================
Recreating api and web services with target image tag...
 Container pharmacy_db Running 
 Container pharmacy_api Running 
 Container pharmacy_web Running 
 Container pharmacy_db Waiting 
 Container pharmacy_db Healthy 
 Container pharmacy_api Waiting 
 Container pharmacy_api Healthy 
Awaiting health check stabilization...
Checking status (1/15): api is healthy, web is healthy...
==========================================================
Rollback successful! Both services are verified healthy.
Current stack status:
NAME           IMAGE                 COMMAND                  SERVICE   STATUS                 PORTS
pharmacy_api   pharmacy-api:latest   "./docker-entrypoint…"   api       Up 3 hours (healthy)   3000/tcp
pharmacy_db    postgres:16-alpine    "docker-entrypoint.s…"   db        Up 3 hours (healthy)   5432/tcp
pharmacy_web   pharmacy-web:latest   "caddy run --config …"   web       Up 3 hours (healthy)   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
==========================================================
```
