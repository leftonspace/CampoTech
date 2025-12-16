-- ═══════════════════════════════════════════════════════════════════════════════
-- CampoTech: Simplify Role System from 6 to 3 Roles
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- This migration reduces the UserRole enum from 6 roles to 3:
--   OLD: OWNER, ADMIN, DISPATCHER, TECHNICIAN, ACCOUNTANT, VIEWER
--   NEW: OWNER, DISPATCHER, TECHNICIAN
--
-- Role Mapping:
--   ADMIN      → OWNER       (admins become owners)
--   ACCOUNTANT → OWNER       (financial access now owner-only)
--   VIEWER     → TECHNICIAN  (minimal read access)
--   OWNER      → OWNER       (no change)
--   DISPATCHER → DISPATCHER  (no change)
--   TECHNICIAN → TECHNICIAN  (no change)
--
-- ⚠️  WARNING: BACKUP DATABASE BEFORE RUNNING
-- ⚠️  Run this AFTER taking a database backup
-- ═══════════════════════════════════════════════════════════════════════════════

-- Step 1: Show current role distribution (for verification)
SELECT role, COUNT(*) as user_count
FROM users
GROUP BY role
ORDER BY role;

-- Step 2: Map old roles to new roles
UPDATE users SET role = 'OWNER' WHERE role = 'ADMIN';
UPDATE users SET role = 'OWNER' WHERE role = 'ACCOUNTANT';
UPDATE users SET role = 'TECHNICIAN' WHERE role = 'VIEWER';

-- Step 3: Verify the migration (should only show OWNER, DISPATCHER, TECHNICIAN)
SELECT role, COUNT(*) as user_count
FROM users
GROUP BY role
ORDER BY role;

-- Step 4: Remove old enum values from the UserRole enum
-- Note: PostgreSQL doesn't support removing enum values directly
-- The enum values will be effectively unused after this migration
-- Prisma will handle the enum definition on next migration

-- ═══════════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Run these queries to verify the migration:
--
-- 1. Check that no users have old roles:
--    SELECT * FROM users WHERE role IN ('ADMIN', 'ACCOUNTANT', 'VIEWER');
--    (Should return 0 rows)
--
-- 2. Check role distribution:
--    SELECT role, COUNT(*) FROM users GROUP BY role;
--    (Should only show OWNER, DISPATCHER, TECHNICIAN)
--
-- ═══════════════════════════════════════════════════════════════════════════════
