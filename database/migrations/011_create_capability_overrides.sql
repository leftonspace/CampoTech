-- Migration: 011_create_capability_overrides
-- Description: Create capability_overrides table for feature flags
-- Created: 2024-01-15

CREATE TABLE capability_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Capability identification
    capability_path TEXT NOT NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Override value
    enabled BOOLEAN NOT NULL,

    -- Metadata
    reason TEXT,
    disabled_by TEXT,
    expires_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one override per capability per org (or global if org_id is null)
    CONSTRAINT unique_capability_override
        UNIQUE (capability_path, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

-- Indexes
CREATE INDEX idx_capability_path ON capability_overrides(capability_path);
CREATE INDEX idx_capability_org ON capability_overrides(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_capability_expires ON capability_overrides(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_capability_overrides_updated_at
    BEFORE UPDATE ON capability_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired overrides
CREATE OR REPLACE FUNCTION cleanup_expired_capability_overrides()
RETURNS void AS $$
BEGIN
    DELETE FROM capability_overrides
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE capability_overrides IS 'Feature flag overrides per org or global';
COMMENT ON COLUMN capability_overrides.capability_path IS 'Dot-notation path like external.afip';
COMMENT ON COLUMN capability_overrides.org_id IS 'NULL for global overrides';
