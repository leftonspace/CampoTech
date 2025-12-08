-- Migration: 014_create_sync_operations
-- Description: Create sync_operations table for offline mobile sync
-- Created: 2024-01-15

CREATE TABLE sync_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Operation details
    action_type TEXT NOT NULL,  -- job_update, job_complete, photo_upload, signature_upload
    entity_type TEXT NOT NULL,
    entity_id UUID,
    local_id TEXT,

    -- Payload
    payload JSONB NOT NULL,

    -- Status
    status sync_status DEFAULT 'pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Conflict resolution
    conflict_data JSONB,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),

    -- Timestamps
    client_created_at TIMESTAMPTZ NOT NULL,
    server_received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_sync_org ON sync_operations(org_id);
CREATE INDEX idx_sync_user ON sync_operations(user_id);
CREATE INDEX idx_sync_status ON sync_operations(org_id, status);
CREATE INDEX idx_sync_entity ON sync_operations(entity_type, entity_id);
CREATE INDEX idx_sync_pending ON sync_operations(org_id, user_id, status)
    WHERE status IN ('pending', 'syncing', 'conflict');

-- Row Level Security
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_user_isolation ON sync_operations
    FOR ALL
    USING (
        org_id = current_setting('app.current_org_id', true)::uuid
        AND (
            user_id = current_setting('app.current_user_id', true)::uuid
            OR current_setting('app.current_user_role', true) IN ('owner', 'admin')
        )
    );

-- Comments
COMMENT ON TABLE sync_operations IS 'Offline sync queue for mobile operations';
COMMENT ON COLUMN sync_operations.local_id IS 'Client-generated ID for offline entities';
COMMENT ON COLUMN sync_operations.client_created_at IS 'Timestamp from mobile device';
