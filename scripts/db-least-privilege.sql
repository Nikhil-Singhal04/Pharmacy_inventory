-- ====================================================================
-- Pharmacy Inventory System — Least-Privilege Database Role Hardening
-- ====================================================================
-- This script provisions a dedicated, least-privileged database role
-- for standard application runtime operations.
--
-- Security Principle:
-- The application runtime should NEVER possess DDL rights (CREATE, ALTER, DROP, TRUNCATE).
-- Only the migration/admin role possesses DDL capabilities.
-- Runtime services are restricted strictly to DML (SELECT, INSERT, UPDATE, DELETE).
-- ====================================================================

-- 1. Create runtime application role if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pharmacy_app_user') THEN
    CREATE ROLE pharmacy_app_user WITH LOGIN PASSWORD 'pharmacy_app_runtime_pass_2026';
  END IF;
END
$$;

-- 2. Revoke default public schema creation privileges
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE pharmacy_db FROM PUBLIC;

-- 3. Grant connection rights to the application database
GRANT CONNECT ON DATABASE pharmacy_db TO pharmacy_app_user;

-- 4. Grant schema usage (allows looking up table objects)
GRANT USAGE ON SCHEMA public TO pharmacy_app_user;

-- 5. Grant only Data Manipulation (DML) rights on existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pharmacy_app_user;

-- 6. Grant sequence usage (for AUTO INCREMENT / serial primary keys)
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO pharmacy_app_user;

-- 7. Ensure future tables and sequences created by migrations also receive these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pharmacy_app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO pharmacy_app_user;

-- ====================================================================
-- Verification Query
-- ====================================================================
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'pharmacy_app_user'
ORDER BY table_name, privilege_type;
