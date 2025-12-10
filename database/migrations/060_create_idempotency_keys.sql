-- Migration: 060_create_idempotency_keys.sql
-- Description: Create idempotency_keys table for request deduplication
-- Purpose: Provide database-backed idempotency alongside Redis for durability
-- Created: 2025-01-10

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: idempotency_keys
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS idempotency_keys (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Key (unique identifier for the operation)
    key TEXT NOT NULL,

    -- Result
    result JSONB,                          -- Result payload to return on duplicate requests
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    status_code INTEGER,                   -- HTTP status code if applicable

    -- Context
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    operation_type TEXT,                   -- e.g., 'create_invoice', 'send_message', 'process_payment'

    -- Request Info (for debugging)
    request_path TEXT,                     -- API endpoint
    request_method TEXT,                   -- HTTP method
    request_hash TEXT,                     -- Hash of request body for validation

    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT idempotency_keys_key_unique UNIQUE (key)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Primary lookup by key (unique constraint creates index)
-- CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key
--     ON idempotency_keys(key);

-- Expiration cleanup
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
    ON idempotency_keys(expires_at);

-- Organization lookup (for admin views)
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_org
    ON idempotency_keys(org_id, created_at DESC)
    WHERE org_id IS NOT NULL;

-- Processing keys (for stuck request detection)
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_processing
    ON idempotency_keys(status, created_at)
    WHERE status = 'processing';

-- Operation type for analysis
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_operation
    ON idempotency_keys(operation_type, created_at DESC)
    WHERE operation_type IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to acquire or check idempotency key
CREATE OR REPLACE FUNCTION acquire_idempotency_key(
    p_key TEXT,
    p_org_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_operation_type TEXT DEFAULT NULL,
    p_request_path TEXT DEFAULT NULL,
    p_request_method TEXT DEFAULT NULL,
    p_request_hash TEXT DEFAULT NULL,
    p_ttl_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    acquired BOOLEAN,
    existing_status TEXT,
    existing_result JSONB,
    existing_status_code INTEGER
) AS $$
DECLARE
    existing_record idempotency_keys%ROWTYPE;
BEGIN
    -- Check for existing key
    SELECT * INTO existing_record
    FROM idempotency_keys
    WHERE key = p_key AND expires_at > NOW();

    IF FOUND THEN
        -- Key exists, return existing data
        RETURN QUERY SELECT
            false AS acquired,
            existing_record.status,
            existing_record.result,
            existing_record.status_code;
    ELSE
        -- Delete expired key if exists
        DELETE FROM idempotency_keys WHERE key = p_key AND expires_at <= NOW();

        -- Insert new key
        INSERT INTO idempotency_keys (
            key, org_id, user_id, operation_type,
            request_path, request_method, request_hash,
            expires_at, status
        ) VALUES (
            p_key, p_org_id, p_user_id, p_operation_type,
            p_request_path, p_request_method, p_request_hash,
            NOW() + (p_ttl_hours || ' hours')::INTERVAL, 'processing'
        );

        RETURN QUERY SELECT true AS acquired, NULL::TEXT, NULL::JSONB, NULL::INTEGER;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to complete idempotency key
CREATE OR REPLACE FUNCTION complete_idempotency_key(
    p_key TEXT,
    p_result JSONB,
    p_status_code INTEGER DEFAULT 200
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE idempotency_keys
    SET
        status = 'completed',
        result = p_result,
        status_code = p_status_code,
        completed_at = NOW()
    WHERE key = p_key AND status = 'processing';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to fail idempotency key
CREATE OR REPLACE FUNCTION fail_idempotency_key(
    p_key TEXT,
    p_error JSONB,
    p_status_code INTEGER DEFAULT 500
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE idempotency_keys
    SET
        status = 'failed',
        result = p_error,
        status_code = p_status_code,
        completed_at = NOW()
    WHERE key = p_key AND status = 'processing';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to detect stuck processing keys (for alerting)
CREATE OR REPLACE FUNCTION get_stuck_idempotency_keys(p_minutes INTEGER DEFAULT 5)
RETURNS TABLE (
    id UUID,
    key TEXT,
    org_id UUID,
    operation_type TEXT,
    created_at TIMESTAMPTZ,
    stuck_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ik.id,
        ik.key,
        ik.org_id,
        ik.operation_type,
        ik.created_at,
        EXTRACT(EPOCH FROM (NOW() - ik.created_at) / 60)::INTEGER AS stuck_minutes
    FROM idempotency_keys ik
    WHERE ik.status = 'processing'
        AND ik.created_at < NOW() - (p_minutes || ' minutes')::INTERVAL
    ORDER BY ik.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Organization isolation for idempotency keys
CREATE POLICY idempotency_keys_org_isolation ON idempotency_keys
    FOR ALL
    USING (
        org_id IS NULL
        OR org_id = current_setting('app.current_org_id', true)::uuid
        OR current_setting('app.current_user_role', true) IN ('owner', 'admin')
    );

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE idempotency_keys IS 'Idempotency keys for request deduplication - database-backed persistence';
COMMENT ON COLUMN idempotency_keys.key IS 'Unique idempotency key (usually UUID or hash)';
COMMENT ON COLUMN idempotency_keys.result IS 'Cached result to return on duplicate requests';
COMMENT ON COLUMN idempotency_keys.status IS 'processing=in progress, completed=success, failed=error';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'When this key expires and can be reused';
COMMENT ON COLUMN idempotency_keys.request_hash IS 'Hash of request body to detect conflicting requests with same key';
COMMENT ON FUNCTION acquire_idempotency_key IS 'Atomically acquire idempotency key or return existing result';
COMMENT ON FUNCTION complete_idempotency_key IS 'Mark idempotency key as completed with result';
COMMENT ON FUNCTION cleanup_expired_idempotency_keys IS 'Remove expired keys - call periodically via cron';
