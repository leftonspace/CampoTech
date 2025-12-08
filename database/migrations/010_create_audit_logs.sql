-- Migration: 010_create_audit_logs
-- Description: Create audit_logs table with integrity chain
-- Created: 2024-01-15

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Event
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,

    -- Data
    old_data JSONB,
    new_data JSONB,
    metadata JSONB,

    -- Integrity chain (for tamper detection)
    previous_hash TEXT,
    entry_hash TEXT NOT NULL,

    -- Timestamp (immutable)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_org_time ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);

-- Function to calculate entry hash
CREATE OR REPLACE FUNCTION calculate_audit_hash()
RETURNS TRIGGER AS $$
DECLARE
    prev_hash TEXT;
    hash_input TEXT;
BEGIN
    -- Get previous hash
    SELECT entry_hash INTO prev_hash
    FROM audit_logs
    WHERE org_id = NEW.org_id
    ORDER BY created_at DESC
    LIMIT 1;

    NEW.previous_hash := prev_hash;

    -- Calculate hash of this entry
    hash_input := COALESCE(NEW.org_id::text, '') ||
                  COALESCE(NEW.user_id::text, '') ||
                  NEW.action ||
                  NEW.entity_type ||
                  COALESCE(NEW.entity_id::text, '') ||
                  COALESCE(NEW.old_data::text, '') ||
                  COALESCE(NEW.new_data::text, '') ||
                  COALESCE(prev_hash, '') ||
                  NEW.created_at::text;

    NEW.entry_hash := encode(sha256(hash_input::bytea), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_audit_entry_hash
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION calculate_audit_hash();

-- Prevent updates and deletes (immutable log)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER prevent_audit_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- Row Level Security (read-only for users)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_org_read ON audit_logs
    FOR SELECT
    USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Comments
COMMENT ON TABLE audit_logs IS 'Immutable audit trail with integrity chain';
COMMENT ON COLUMN audit_logs.entry_hash IS 'SHA-256 hash including previous entry for tamper detection';
