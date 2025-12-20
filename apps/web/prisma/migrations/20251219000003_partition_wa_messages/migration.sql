-- Phase 5A.1.3: WhatsApp Messages Table Partitioning
-- ===================================================
-- Partitions the wa_messages table by created_at (weekly partitions)
-- High volume table - weekly partitions for optimal performance
--
-- IMPORTANT: This is a major schema change. Ensure you have:
-- 1. Full database backup
-- 2. Tested on staging environment
-- 3. Scheduled maintenance window
-- 4. Rollback plan ready

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Create the partitioned table structure
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wa_messages_partitioned (
    id TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "customerId" TEXT,
    "waMessageId" TEXT,
    direction TEXT NOT NULL,
    type TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    content TEXT NOT NULL,
    "mediaId" TEXT,
    "mediaUrl" TEXT,
    "mediaMimeType" TEXT,
    "mediaFilename" TEXT,
    "templateName" TEXT,
    "templateParams" JSONB,
    metadata JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    "statusUpdatedAt" TIMESTAMPTZ,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentByUserId" TEXT,
    "sentByUserName" TEXT,
    "processedByAi" BOOLEAN DEFAULT FALSE,
    "aiConfidence" DECIMAL(5, 4),
    "aiResponseTime" INTEGER,
    "readAt" TIMESTAMPTZ,
    "deliveredAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite primary key required for partitioning
    PRIMARY KEY (id, "createdAt")
) PARTITION BY RANGE ("createdAt");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Create weekly partitions for 2025 (52 weeks)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 2025 Week 1-13 (Q1)
CREATE TABLE IF NOT EXISTS wa_msgs_2025w01 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2024-12-30') TO ('2025-01-06');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w02 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-01-06') TO ('2025-01-13');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w03 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-01-13') TO ('2025-01-20');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w04 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-01-20') TO ('2025-01-27');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w05 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-01-27') TO ('2025-02-03');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w06 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-02-03') TO ('2025-02-10');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w07 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-02-10') TO ('2025-02-17');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w08 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-02-17') TO ('2025-02-24');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w09 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-02-24') TO ('2025-03-03');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w10 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-03-03') TO ('2025-03-10');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w11 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-03-10') TO ('2025-03-17');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w12 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-03-17') TO ('2025-03-24');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w13 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-03-24') TO ('2025-03-31');

-- 2025 Week 14-26 (Q2)
CREATE TABLE IF NOT EXISTS wa_msgs_2025w14 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-03-31') TO ('2025-04-07');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w15 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-04-07') TO ('2025-04-14');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w16 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-04-14') TO ('2025-04-21');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w17 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-04-21') TO ('2025-04-28');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w18 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-04-28') TO ('2025-05-05');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w19 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-05-05') TO ('2025-05-12');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w20 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-05-12') TO ('2025-05-19');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w21 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-05-19') TO ('2025-05-26');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w22 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-05-26') TO ('2025-06-02');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w23 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-06-02') TO ('2025-06-09');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w24 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-06-09') TO ('2025-06-16');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w25 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-06-16') TO ('2025-06-23');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w26 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-06-23') TO ('2025-06-30');

-- 2025 Week 27-39 (Q3)
CREATE TABLE IF NOT EXISTS wa_msgs_2025w27 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-06-30') TO ('2025-07-07');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w28 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-07-07') TO ('2025-07-14');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w29 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-07-14') TO ('2025-07-21');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w30 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-07-21') TO ('2025-07-28');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w31 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-07-28') TO ('2025-08-04');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w32 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-08-04') TO ('2025-08-11');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w33 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-08-11') TO ('2025-08-18');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w34 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-08-18') TO ('2025-08-25');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w35 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-08-25') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w36 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-09-01') TO ('2025-09-08');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w37 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-09-08') TO ('2025-09-15');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w38 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-09-15') TO ('2025-09-22');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w39 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-09-22') TO ('2025-09-29');

-- 2025 Week 40-52 (Q4)
CREATE TABLE IF NOT EXISTS wa_msgs_2025w40 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-09-29') TO ('2025-10-06');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w41 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-10-06') TO ('2025-10-13');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w42 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-10-13') TO ('2025-10-20');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w43 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-10-20') TO ('2025-10-27');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w44 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-10-27') TO ('2025-11-03');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w45 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-11-03') TO ('2025-11-10');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w46 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-11-10') TO ('2025-11-17');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w47 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-11-17') TO ('2025-11-24');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w48 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-11-24') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w49 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2025-12-08');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w50 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-12-08') TO ('2025-12-15');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w51 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-12-15') TO ('2025-12-22');
CREATE TABLE IF NOT EXISTS wa_msgs_2025w52 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-12-22') TO ('2025-12-29');

-- 2026 Q1 Partitions (12 weeks ahead)
CREATE TABLE IF NOT EXISTS wa_msgs_2026w01 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2025-12-29') TO ('2026-01-05');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w02 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-01-05') TO ('2026-01-12');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w03 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-01-12') TO ('2026-01-19');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w04 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-01-19') TO ('2026-01-26');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w05 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-01-26') TO ('2026-02-02');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w06 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-02-02') TO ('2026-02-09');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w07 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-02-09') TO ('2026-02-16');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w08 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-02-16') TO ('2026-02-23');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w09 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-02-23') TO ('2026-03-02');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w10 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-03-02') TO ('2026-03-09');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w11 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-03-09') TO ('2026-03-16');
CREATE TABLE IF NOT EXISTS wa_msgs_2026w12 PARTITION OF wa_messages_partitioned
    FOR VALUES FROM ('2026-03-16') TO ('2026-03-23');

-- Default partition for historical data (before 2025)
CREATE TABLE IF NOT EXISTS wa_msgs_default PARTITION OF wa_messages_partitioned
    DEFAULT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Create indexes on partitioned table
-- ═══════════════════════════════════════════════════════════════════════════════

-- Unique constraint on waMessageId (must include partition key for partitioned tables)
-- Note: waMessageId is unique within each partition (time period)
CREATE UNIQUE INDEX IF NOT EXISTS wa_messages_part_wa_id_key
    ON wa_messages_partitioned("waMessageId", "createdAt")
    WHERE "waMessageId" IS NOT NULL;

-- Main query pattern indexes
CREATE INDEX IF NOT EXISTS idx_wa_msgs_part_org_created
    ON wa_messages_partitioned("organizationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msgs_part_conv_created
    ON wa_messages_partitioned("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msgs_part_org_status
    ON wa_messages_partitioned("organizationId", status);
CREATE INDEX IF NOT EXISTS idx_wa_msgs_part_customer
    ON wa_messages_partitioned("customerId")
    WHERE "customerId" IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Data migration function
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION migrate_wa_messages_to_partitioned(batch_size INTEGER DEFAULT 10000)
RETURNS INTEGER AS $$
DECLARE
    migrated_count INTEGER := 0;
    batch_count INTEGER;
BEGIN
    LOOP
        WITH moved AS (
            INSERT INTO wa_messages_partitioned (
                id, "organizationId", "conversationId", "customerId", "waMessageId",
                direction, type, "from", "to", content,
                "mediaId", "mediaUrl", "mediaMimeType", "mediaFilename",
                "templateName", "templateParams", metadata,
                status, "statusUpdatedAt", "errorCode", "errorMessage",
                "sentByUserId", "sentByUserName", "processedByAi",
                "aiConfidence", "aiResponseTime", "readAt", "deliveredAt",
                "createdAt", "updatedAt"
            )
            SELECT
                id, "organizationId", "conversationId", "customerId", "waMessageId",
                direction, type, "from", "to", content,
                "mediaId", "mediaUrl", "mediaMimeType", "mediaFilename",
                "templateName", "templateParams", metadata,
                status, "statusUpdatedAt", "errorCode", "errorMessage",
                "sentByUserId", "sentByUserName", "processedByAi",
                "aiConfidence", "aiResponseTime", "readAt", "deliveredAt",
                "createdAt", "updatedAt"
            FROM wa_messages
            WHERE id NOT IN (SELECT id FROM wa_messages_partitioned)
            LIMIT batch_size
            ON CONFLICT DO NOTHING
            RETURNING 1
        )
        SELECT COUNT(*) INTO batch_count FROM moved;

        migrated_count := migrated_count + batch_count;

        IF batch_count = 0 THEN
            EXIT;
        END IF;

        RAISE NOTICE 'WA Messages: Migrated % records (total: %)', batch_count, migrated_count;
    END LOOP;

    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOCUMENTATION
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE wa_messages_partitioned IS 'Partitioned WhatsApp messages table (Phase 5A.1.3) - Weekly partitions by created_at';

-- To migrate data:
-- SELECT migrate_wa_messages_to_partitioned(10000);

-- To verify:
-- SELECT
--     (SELECT COUNT(*) FROM wa_messages) as old_count,
--     (SELECT COUNT(*) FROM wa_messages_partitioned) as new_count;

-- To swap tables (maintenance window):
-- BEGIN;
-- ALTER TABLE wa_messages RENAME TO wa_messages_old;
-- ALTER TABLE wa_messages_partitioned RENAME TO wa_messages;
-- COMMIT;
