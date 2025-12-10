-- Migration: 059_create_failed_jobs.sql
-- Description: Create failed_jobs table for Dead Letter Queue (DLQ)
-- Purpose: Persist failed queue jobs for manual review and retry
-- Created: 2025-01-10

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: failed_jobs (Dead Letter Queue)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS failed_jobs (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Queue Info
    queue_name TEXT NOT NULL,             -- e.g., 'whatsapp', 'afip', 'voice-processing'
    job_id TEXT NOT NULL,                 -- Original BullMQ job ID
    job_name TEXT,                        -- Job type/name within the queue

    -- Job Data
    job_data JSONB NOT NULL,              -- Original job payload

    -- Error Details
    error_message TEXT NOT NULL,
    error_stack TEXT,
    error_code TEXT,
    error_type TEXT,                      -- e.g., 'timeout', 'validation', 'network', 'unknown'

    -- Attempts
    attempts INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),

    -- Context
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    related_entity_type TEXT,             -- e.g., 'invoice', 'payment', 'message'
    related_entity_id UUID,

    -- Status & Resolution
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'retried', 'discarded', 'resolved')),
    priority INTEGER DEFAULT 0,           -- Higher = more important
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    resolution_type TEXT,                 -- 'manual_retry', 'auto_retry', 'data_fix', 'skipped', 'duplicate'

    -- Retry Tracking
    retry_job_id TEXT,                    -- New job ID if retried
    retried_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,

    -- Tags for filtering/categorization
    tags TEXT[] DEFAULT '{}',

    -- Timestamps
    failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Filter by queue
CREATE INDEX IF NOT EXISTS idx_failed_jobs_queue
    ON failed_jobs(queue_name, status);

-- Filter by organization
CREATE INDEX IF NOT EXISTS idx_failed_jobs_org
    ON failed_jobs(org_id, status)
    WHERE org_id IS NOT NULL;

-- Pending jobs for review (sorted by priority and age)
CREATE INDEX IF NOT EXISTS idx_failed_jobs_pending
    ON failed_jobs(priority DESC, failed_at ASC)
    WHERE status = 'pending';

-- Related entity lookup
CREATE INDEX IF NOT EXISTS idx_failed_jobs_entity
    ON failed_jobs(related_entity_type, related_entity_id)
    WHERE related_entity_id IS NOT NULL;

-- Error type for analysis
CREATE INDEX IF NOT EXISTS idx_failed_jobs_error_type
    ON failed_jobs(error_type, failed_at);

-- Tags search
CREATE INDEX IF NOT EXISTS idx_failed_jobs_tags
    ON failed_jobs USING GIN(tags);

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to get failed jobs statistics by queue
CREATE OR REPLACE FUNCTION get_failed_jobs_stats(p_org_id UUID DEFAULT NULL)
RETURNS TABLE (
    queue_name TEXT,
    pending_count BIGINT,
    retried_count BIGINT,
    discarded_count BIGINT,
    resolved_count BIGINT,
    oldest_pending TIMESTAMPTZ,
    avg_resolution_hours DECIMAL(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fj.queue_name,
        COUNT(*) FILTER (WHERE fj.status = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE fj.status = 'retried') AS retried_count,
        COUNT(*) FILTER (WHERE fj.status = 'discarded') AS discarded_count,
        COUNT(*) FILTER (WHERE fj.status = 'resolved') AS resolved_count,
        MIN(fj.failed_at) FILTER (WHERE fj.status = 'pending') AS oldest_pending,
        ROUND(AVG(
            EXTRACT(EPOCH FROM (fj.resolved_at - fj.failed_at)) / 3600
        ) FILTER (WHERE fj.resolved_at IS NOT NULL)::DECIMAL, 2) AS avg_resolution_hours
    FROM failed_jobs fj
    WHERE (p_org_id IS NULL OR fj.org_id = p_org_id)
    GROUP BY fj.queue_name
    ORDER BY pending_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent failure patterns (for alerting)
CREATE OR REPLACE FUNCTION get_failure_patterns(p_hours INTEGER DEFAULT 24)
RETURNS TABLE (
    queue_name TEXT,
    error_type TEXT,
    failure_count BIGINT,
    first_failure TIMESTAMPTZ,
    last_failure TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fj.queue_name,
        fj.error_type,
        COUNT(*) AS failure_count,
        MIN(fj.failed_at) AS first_failure,
        MAX(fj.failed_at) AS last_failure
    FROM failed_jobs fj
    WHERE fj.failed_at >= NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY fj.queue_name, fj.error_type
    HAVING COUNT(*) >= 3
    ORDER BY failure_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to mark job as resolved
CREATE OR REPLACE FUNCTION resolve_failed_job(
    p_job_id UUID,
    p_resolved_by UUID,
    p_resolution_type TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE failed_jobs
    SET
        status = 'resolved',
        resolved_by = p_resolved_by,
        resolved_at = NOW(),
        resolution_type = p_resolution_type,
        resolution_notes = p_notes
    WHERE id = p_job_id
        AND status IN ('pending', 'retrying');

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old resolved jobs
CREATE OR REPLACE FUNCTION cleanup_old_failed_jobs(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM failed_jobs
    WHERE status IN ('resolved', 'discarded', 'retried')
        AND created_at < NOW() - (p_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE failed_jobs ENABLE ROW LEVEL SECURITY;

-- Admins can see all failed jobs, others see only their org's
CREATE POLICY failed_jobs_access ON failed_jobs
    FOR ALL
    USING (
        current_setting('app.current_user_role', true) IN ('owner', 'admin')
        OR org_id = current_setting('app.current_org_id', true)::uuid
        OR org_id IS NULL
    );

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE failed_jobs IS 'Dead Letter Queue - Failed queue jobs for manual review/retry';
COMMENT ON COLUMN failed_jobs.queue_name IS 'BullMQ queue name where the job failed';
COMMENT ON COLUMN failed_jobs.job_id IS 'Original BullMQ job ID';
COMMENT ON COLUMN failed_jobs.job_data IS 'Original job payload (JSONB) for retry';
COMMENT ON COLUMN failed_jobs.error_type IS 'Categorized error type for analysis';
COMMENT ON COLUMN failed_jobs.status IS 'pending=needs review, retrying=in progress, retried=retry succeeded, discarded=manually skipped, resolved=fixed';
COMMENT ON COLUMN failed_jobs.priority IS 'Higher priority jobs shown first in review queue';
COMMENT ON COLUMN failed_jobs.resolution_type IS 'How the job was resolved: manual_retry, auto_retry, data_fix, skipped, duplicate';
