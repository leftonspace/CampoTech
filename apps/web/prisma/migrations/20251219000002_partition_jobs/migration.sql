-- Phase 5A.1.2: Jobs Table Partitioning
-- =====================================
-- Partitions the jobs table by created_at (monthly partitions)
-- This migration should be run during a maintenance window
--
-- IMPORTANT: This is a major schema change. Ensure you have:
-- 1. Full database backup
-- 2. Tested on staging environment
-- 3. Scheduled maintenance window
-- 4. Rollback plan ready

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Create the partitioned table structure
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS jobs_partitioned (
    id TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    urgency TEXT NOT NULL DEFAULT 'NORMAL',
    "scheduledDate" TIMESTAMPTZ,
    "scheduledTimeSlot" JSONB,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    resolution TEXT,
    "materialsUsed" JSONB,
    photos TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customerSignature" TEXT,
    "estimatedDuration" INTEGER,
    "actualDuration" INTEGER,
    "customerId" TEXT NOT NULL,
    "technicianId" TEXT,
    "createdById" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT,
    "zoneId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite primary key required for partitioning
    PRIMARY KEY (id, "createdAt")
) PARTITION BY RANGE ("createdAt");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Create partitions for 2025-2027 (24+ months ahead)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 2025 Partitions
CREATE TABLE IF NOT EXISTS jobs_y2025m01 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m02 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m03 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m04 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m05 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m06 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m07 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m08 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m09 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m10 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m11 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS jobs_y2025m12 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 2026 Partitions
CREATE TABLE IF NOT EXISTS jobs_y2026m01 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m02 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m03 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m04 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m05 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m06 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m07 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m08 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m09 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m10 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m11 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS jobs_y2026m12 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- 2027 Partitions (first quarter)
CREATE TABLE IF NOT EXISTS jobs_y2027m01 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE IF NOT EXISTS jobs_y2027m02 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE IF NOT EXISTS jobs_y2027m03 PARTITION OF jobs_partitioned
    FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

-- Default partition for historical data (before 2025)
CREATE TABLE IF NOT EXISTS jobs_default PARTITION OF jobs_partitioned
    DEFAULT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Create indexes on each partition (for common query patterns)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Unique constraint on jobNumber (must include partition key)
CREATE UNIQUE INDEX IF NOT EXISTS jobs_partitioned_job_number_key
    ON jobs_partitioned("jobNumber");

-- Main query pattern indexes (these inherit to all partitions automatically)
CREATE INDEX IF NOT EXISTS idx_jobs_part_org_status
    ON jobs_partitioned("organizationId", status);
CREATE INDEX IF NOT EXISTS idx_jobs_part_org_scheduled
    ON jobs_partitioned("organizationId", "scheduledDate");
CREATE INDEX IF NOT EXISTS idx_jobs_part_tech_status
    ON jobs_partitioned("technicianId", status);
CREATE INDEX IF NOT EXISTS idx_jobs_part_customer
    ON jobs_partitioned("customerId");
CREATE INDEX IF NOT EXISTS idx_jobs_part_status
    ON jobs_partitioned(status);
CREATE INDEX IF NOT EXISTS idx_jobs_part_location
    ON jobs_partitioned("locationId");
CREATE INDEX IF NOT EXISTS idx_jobs_part_zone
    ON jobs_partitioned("zoneId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Data migration function (run in batches to avoid locking)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create a function to migrate data in batches
CREATE OR REPLACE FUNCTION migrate_jobs_to_partitioned(batch_size INTEGER DEFAULT 10000)
RETURNS INTEGER AS $$
DECLARE
    migrated_count INTEGER := 0;
    batch_count INTEGER;
BEGIN
    LOOP
        -- Insert batch of records
        WITH moved AS (
            INSERT INTO jobs_partitioned (
                id, "jobNumber", "serviceType", description, status, urgency,
                "scheduledDate", "scheduledTimeSlot", "startedAt", "completedAt",
                resolution, "materialsUsed", photos, "customerSignature",
                "estimatedDuration", "actualDuration", "customerId", "technicianId",
                "createdById", "organizationId", "locationId", "zoneId",
                "createdAt", "updatedAt"
            )
            SELECT
                id, "jobNumber", "serviceType"::TEXT, description, status::TEXT, urgency::TEXT,
                "scheduledDate", "scheduledTimeSlot", "startedAt", "completedAt",
                resolution, "materialsUsed", photos, "customerSignature",
                "estimatedDuration", "actualDuration", "customerId", "technicianId",
                "createdById", "organizationId", "locationId", "zoneId",
                "createdAt", "updatedAt"
            FROM jobs
            WHERE id NOT IN (SELECT id FROM jobs_partitioned)
            LIMIT batch_size
            ON CONFLICT DO NOTHING
            RETURNING 1
        )
        SELECT COUNT(*) INTO batch_count FROM moved;

        migrated_count := migrated_count + batch_count;

        -- Exit if no more records
        IF batch_count = 0 THEN
            EXIT;
        END IF;

        -- Commit progress
        RAISE NOTICE 'Migrated % records (total: %)', batch_count, migrated_count;
    END LOOP;

    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 5: Table swap procedure (run during maintenance window)
-- ═══════════════════════════════════════════════════════════════════════════════

-- NOTE: These commands should be run MANUALLY during a maintenance window
-- after verifying the migration was successful.

-- To migrate data:
-- SELECT migrate_jobs_to_partitioned(10000);

-- To verify data:
-- SELECT
--     (SELECT COUNT(*) FROM jobs) as old_count,
--     (SELECT COUNT(*) FROM jobs_partitioned) as new_count;

-- To swap tables (during maintenance window):
-- BEGIN;
-- ALTER TABLE jobs RENAME TO jobs_old;
-- ALTER TABLE jobs_partitioned RENAME TO jobs;
-- -- Update foreign key constraints if needed
-- COMMIT;

-- To rollback if needed:
-- BEGIN;
-- ALTER TABLE jobs RENAME TO jobs_partitioned;
-- ALTER TABLE jobs_old RENAME TO jobs;
-- COMMIT;

-- To clean up after verification (wait at least 1 week):
-- DROP FUNCTION IF EXISTS migrate_jobs_to_partitioned;
-- DROP TABLE IF EXISTS jobs_old;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 6: Add comment for documentation
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE jobs_partitioned IS 'Partitioned jobs table (Phase 5A.1.2) - Monthly partitions by created_at';
