-- Phase 5A.1.4: Technician Location History Table Partitioning
-- =============================================================
-- Partitions the technician_location_history table by recorded_at (daily partitions)
-- CRITICAL: Highest volume table - GPS pings every 30s per active technician
-- Expected: 50M+ rows/month at scale
--
-- IMPORTANT: This is a major schema change. Ensure you have:
-- 1. Full database backup
-- 2. Tested on staging environment
-- 3. Scheduled maintenance window
-- 4. Rollback plan ready

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Create the partitioned table structure
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tech_location_history_partitioned (
    id TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "sessionId" TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    speed DECIMAL(6, 2),
    "movementMode" TEXT,
    "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite primary key required for partitioning
    PRIMARY KEY (id, "recordedAt")
) PARTITION BY RANGE ("recordedAt");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Create daily partitions for 90+ days ahead (December 2024 - March 2025)
-- ═══════════════════════════════════════════════════════════════════════════════

-- December 2024 (remaining days)
CREATE TABLE IF NOT EXISTS tech_loc_20241215 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-15') TO ('2024-12-16');
CREATE TABLE IF NOT EXISTS tech_loc_20241216 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-16') TO ('2024-12-17');
CREATE TABLE IF NOT EXISTS tech_loc_20241217 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-17') TO ('2024-12-18');
CREATE TABLE IF NOT EXISTS tech_loc_20241218 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-18') TO ('2024-12-19');
CREATE TABLE IF NOT EXISTS tech_loc_20241219 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-19') TO ('2024-12-20');
CREATE TABLE IF NOT EXISTS tech_loc_20241220 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-20') TO ('2024-12-21');
CREATE TABLE IF NOT EXISTS tech_loc_20241221 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-21') TO ('2024-12-22');
CREATE TABLE IF NOT EXISTS tech_loc_20241222 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-22') TO ('2024-12-23');
CREATE TABLE IF NOT EXISTS tech_loc_20241223 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-23') TO ('2024-12-24');
CREATE TABLE IF NOT EXISTS tech_loc_20241224 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-24') TO ('2024-12-25');
CREATE TABLE IF NOT EXISTS tech_loc_20241225 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-25') TO ('2024-12-26');
CREATE TABLE IF NOT EXISTS tech_loc_20241226 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-26') TO ('2024-12-27');
CREATE TABLE IF NOT EXISTS tech_loc_20241227 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-27') TO ('2024-12-28');
CREATE TABLE IF NOT EXISTS tech_loc_20241228 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-28') TO ('2024-12-29');
CREATE TABLE IF NOT EXISTS tech_loc_20241229 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-29') TO ('2024-12-30');
CREATE TABLE IF NOT EXISTS tech_loc_20241230 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-30') TO ('2024-12-31');
CREATE TABLE IF NOT EXISTS tech_loc_20241231 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2024-12-31') TO ('2025-01-01');

-- January 2025
CREATE TABLE IF NOT EXISTS tech_loc_20250101 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-01-02');
CREATE TABLE IF NOT EXISTS tech_loc_20250102 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-02') TO ('2025-01-03');
CREATE TABLE IF NOT EXISTS tech_loc_20250103 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-03') TO ('2025-01-04');
CREATE TABLE IF NOT EXISTS tech_loc_20250104 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-04') TO ('2025-01-05');
CREATE TABLE IF NOT EXISTS tech_loc_20250105 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-05') TO ('2025-01-06');
CREATE TABLE IF NOT EXISTS tech_loc_20250106 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-06') TO ('2025-01-07');
CREATE TABLE IF NOT EXISTS tech_loc_20250107 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-07') TO ('2025-01-08');
CREATE TABLE IF NOT EXISTS tech_loc_20250108 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-08') TO ('2025-01-09');
CREATE TABLE IF NOT EXISTS tech_loc_20250109 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-09') TO ('2025-01-10');
CREATE TABLE IF NOT EXISTS tech_loc_20250110 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-10') TO ('2025-01-11');
CREATE TABLE IF NOT EXISTS tech_loc_20250111 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-11') TO ('2025-01-12');
CREATE TABLE IF NOT EXISTS tech_loc_20250112 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-12') TO ('2025-01-13');
CREATE TABLE IF NOT EXISTS tech_loc_20250113 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-13') TO ('2025-01-14');
CREATE TABLE IF NOT EXISTS tech_loc_20250114 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-14') TO ('2025-01-15');
CREATE TABLE IF NOT EXISTS tech_loc_20250115 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-15') TO ('2025-01-16');
CREATE TABLE IF NOT EXISTS tech_loc_20250116 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-16') TO ('2025-01-17');
CREATE TABLE IF NOT EXISTS tech_loc_20250117 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-17') TO ('2025-01-18');
CREATE TABLE IF NOT EXISTS tech_loc_20250118 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-18') TO ('2025-01-19');
CREATE TABLE IF NOT EXISTS tech_loc_20250119 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-19') TO ('2025-01-20');
CREATE TABLE IF NOT EXISTS tech_loc_20250120 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-20') TO ('2025-01-21');
CREATE TABLE IF NOT EXISTS tech_loc_20250121 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-21') TO ('2025-01-22');
CREATE TABLE IF NOT EXISTS tech_loc_20250122 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-22') TO ('2025-01-23');
CREATE TABLE IF NOT EXISTS tech_loc_20250123 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-23') TO ('2025-01-24');
CREATE TABLE IF NOT EXISTS tech_loc_20250124 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-24') TO ('2025-01-25');
CREATE TABLE IF NOT EXISTS tech_loc_20250125 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-25') TO ('2025-01-26');
CREATE TABLE IF NOT EXISTS tech_loc_20250126 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-26') TO ('2025-01-27');
CREATE TABLE IF NOT EXISTS tech_loc_20250127 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-27') TO ('2025-01-28');
CREATE TABLE IF NOT EXISTS tech_loc_20250128 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-28') TO ('2025-01-29');
CREATE TABLE IF NOT EXISTS tech_loc_20250129 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-29') TO ('2025-01-30');
CREATE TABLE IF NOT EXISTS tech_loc_20250130 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-30') TO ('2025-01-31');
CREATE TABLE IF NOT EXISTS tech_loc_20250131 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-01-31') TO ('2025-02-01');

-- February 2025
CREATE TABLE IF NOT EXISTS tech_loc_20250201 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-02-02');
CREATE TABLE IF NOT EXISTS tech_loc_20250202 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-02') TO ('2025-02-03');
CREATE TABLE IF NOT EXISTS tech_loc_20250203 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-03') TO ('2025-02-04');
CREATE TABLE IF NOT EXISTS tech_loc_20250204 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-04') TO ('2025-02-05');
CREATE TABLE IF NOT EXISTS tech_loc_20250205 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-05') TO ('2025-02-06');
CREATE TABLE IF NOT EXISTS tech_loc_20250206 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-06') TO ('2025-02-07');
CREATE TABLE IF NOT EXISTS tech_loc_20250207 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-07') TO ('2025-02-08');
CREATE TABLE IF NOT EXISTS tech_loc_20250208 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-08') TO ('2025-02-09');
CREATE TABLE IF NOT EXISTS tech_loc_20250209 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-09') TO ('2025-02-10');
CREATE TABLE IF NOT EXISTS tech_loc_20250210 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-10') TO ('2025-02-11');
CREATE TABLE IF NOT EXISTS tech_loc_20250211 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-11') TO ('2025-02-12');
CREATE TABLE IF NOT EXISTS tech_loc_20250212 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-12') TO ('2025-02-13');
CREATE TABLE IF NOT EXISTS tech_loc_20250213 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-13') TO ('2025-02-14');
CREATE TABLE IF NOT EXISTS tech_loc_20250214 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-14') TO ('2025-02-15');
CREATE TABLE IF NOT EXISTS tech_loc_20250215 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-15') TO ('2025-02-16');
CREATE TABLE IF NOT EXISTS tech_loc_20250216 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-16') TO ('2025-02-17');
CREATE TABLE IF NOT EXISTS tech_loc_20250217 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-17') TO ('2025-02-18');
CREATE TABLE IF NOT EXISTS tech_loc_20250218 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-18') TO ('2025-02-19');
CREATE TABLE IF NOT EXISTS tech_loc_20250219 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-19') TO ('2025-02-20');
CREATE TABLE IF NOT EXISTS tech_loc_20250220 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-20') TO ('2025-02-21');
CREATE TABLE IF NOT EXISTS tech_loc_20250221 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-21') TO ('2025-02-22');
CREATE TABLE IF NOT EXISTS tech_loc_20250222 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-22') TO ('2025-02-23');
CREATE TABLE IF NOT EXISTS tech_loc_20250223 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-23') TO ('2025-02-24');
CREATE TABLE IF NOT EXISTS tech_loc_20250224 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-24') TO ('2025-02-25');
CREATE TABLE IF NOT EXISTS tech_loc_20250225 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-25') TO ('2025-02-26');
CREATE TABLE IF NOT EXISTS tech_loc_20250226 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-26') TO ('2025-02-27');
CREATE TABLE IF NOT EXISTS tech_loc_20250227 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-27') TO ('2025-02-28');
CREATE TABLE IF NOT EXISTS tech_loc_20250228 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-02-28') TO ('2025-03-01');

-- March 2025
CREATE TABLE IF NOT EXISTS tech_loc_20250301 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-03-02');
CREATE TABLE IF NOT EXISTS tech_loc_20250302 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-02') TO ('2025-03-03');
CREATE TABLE IF NOT EXISTS tech_loc_20250303 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-03') TO ('2025-03-04');
CREATE TABLE IF NOT EXISTS tech_loc_20250304 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-04') TO ('2025-03-05');
CREATE TABLE IF NOT EXISTS tech_loc_20250305 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-05') TO ('2025-03-06');
CREATE TABLE IF NOT EXISTS tech_loc_20250306 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-06') TO ('2025-03-07');
CREATE TABLE IF NOT EXISTS tech_loc_20250307 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-07') TO ('2025-03-08');
CREATE TABLE IF NOT EXISTS tech_loc_20250308 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-08') TO ('2025-03-09');
CREATE TABLE IF NOT EXISTS tech_loc_20250309 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-09') TO ('2025-03-10');
CREATE TABLE IF NOT EXISTS tech_loc_20250310 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-10') TO ('2025-03-11');
CREATE TABLE IF NOT EXISTS tech_loc_20250311 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-11') TO ('2025-03-12');
CREATE TABLE IF NOT EXISTS tech_loc_20250312 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-12') TO ('2025-03-13');
CREATE TABLE IF NOT EXISTS tech_loc_20250313 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-13') TO ('2025-03-14');
CREATE TABLE IF NOT EXISTS tech_loc_20250314 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-14') TO ('2025-03-15');
CREATE TABLE IF NOT EXISTS tech_loc_20250315 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-15') TO ('2025-03-16');
CREATE TABLE IF NOT EXISTS tech_loc_20250316 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-16') TO ('2025-03-17');
CREATE TABLE IF NOT EXISTS tech_loc_20250317 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-17') TO ('2025-03-18');
CREATE TABLE IF NOT EXISTS tech_loc_20250318 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-18') TO ('2025-03-19');
CREATE TABLE IF NOT EXISTS tech_loc_20250319 PARTITION OF tech_location_history_partitioned
    FOR VALUES FROM ('2025-03-19') TO ('2025-03-20');

-- Default partition for any data outside defined ranges
CREATE TABLE IF NOT EXISTS tech_loc_default PARTITION OF tech_location_history_partitioned
    DEFAULT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Create indexes on partitioned table
-- ═══════════════════════════════════════════════════════════════════════════════

-- Main query pattern indexes
CREATE INDEX IF NOT EXISTS idx_tech_loc_part_user_recorded
    ON tech_location_history_partitioned("userId", "recordedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_tech_loc_part_job
    ON tech_location_history_partitioned("jobId")
    WHERE "jobId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tech_loc_part_session
    ON tech_location_history_partitioned("sessionId")
    WHERE "sessionId" IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Data migration function
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION migrate_tech_locations_to_partitioned(batch_size INTEGER DEFAULT 50000)
RETURNS INTEGER AS $$
DECLARE
    migrated_count INTEGER := 0;
    batch_count INTEGER;
BEGIN
    LOOP
        WITH moved AS (
            INSERT INTO tech_location_history_partitioned (
                id, "userId", "jobId", "sessionId",
                latitude, longitude, accuracy, heading, speed,
                "movementMode", "recordedAt"
            )
            SELECT
                id, "userId", "jobId", "sessionId",
                latitude, longitude, accuracy, heading, speed,
                "movementMode", "recordedAt"
            FROM technician_location_history
            WHERE id NOT IN (SELECT id FROM tech_location_history_partitioned)
            LIMIT batch_size
            ON CONFLICT DO NOTHING
            RETURNING 1
        )
        SELECT COUNT(*) INTO batch_count FROM moved;

        migrated_count := migrated_count + batch_count;

        IF batch_count = 0 THEN
            EXIT;
        END IF;

        -- Progress logging every batch (important for large tables)
        RAISE NOTICE 'Tech Locations: Migrated % records (total: %)', batch_count, migrated_count;

        -- Brief pause to reduce lock contention
        PERFORM pg_sleep(0.1);
    END LOOP;

    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOCUMENTATION
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE tech_location_history_partitioned IS
    'Partitioned technician location history (Phase 5A.1.4) - Daily partitions by recorded_at. CRITICAL: Highest volume table.';

-- To migrate data:
-- SELECT migrate_tech_locations_to_partitioned(50000);

-- To verify:
-- SELECT
--     (SELECT COUNT(*) FROM technician_location_history) as old_count,
--     (SELECT COUNT(*) FROM tech_location_history_partitioned) as new_count;

-- To check partition sizes:
-- SELECT
--     inhrelid::regclass AS partition_name,
--     pg_size_pretty(pg_relation_size(inhrelid)) AS size
-- FROM pg_inherits
-- WHERE inhparent = 'tech_location_history_partitioned'::regclass
-- ORDER BY inhrelid::regclass::text;

-- To swap tables (maintenance window):
-- BEGIN;
-- ALTER TABLE technician_location_history RENAME TO technician_location_history_old;
-- ALTER TABLE tech_location_history_partitioned RENAME TO technician_location_history;
-- COMMIT;
