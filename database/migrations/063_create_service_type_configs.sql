-- Migration: 063_create_service_type_configs
-- Description: Create service_type_configs table for configurable service types per organization
-- Created: 2025-12-12

-- ═══════════════════════════════════════════════════════════════════════════════
-- SERVICE TYPE CONFIGURATION
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS service_type_configs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Service Type Info
    code VARCHAR(100) NOT NULL,           -- Internal code (e.g., "INSTALACION_SPLIT")
    name VARCHAR(255) NOT NULL,           -- Display name (e.g., "Instalación Split")
    description TEXT,                     -- Optional description
    color VARCHAR(20),                    -- Optional color for UI (hex code)
    icon VARCHAR(100),                    -- Optional icon name

    -- Status
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one code per organization
    CONSTRAINT unique_org_service_type_code UNIQUE (organization_id, code)
);

-- Indexes (use IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS idx_service_type_configs_org ON service_type_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_type_configs_active ON service_type_configs(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_service_type_configs_sort ON service_type_configs(organization_id, sort_order);

-- Trigger for updated_at (drop first if exists for idempotency)
DROP TRIGGER IF EXISTS update_service_type_configs_updated_at ON service_type_configs;
CREATE TRIGGER update_service_type_configs_updated_at
    BEFORE UPDATE ON service_type_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE service_type_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_type_configs_org_isolation ON service_type_configs;
CREATE POLICY service_type_configs_org_isolation ON service_type_configs
    FOR ALL
    USING (organization_id = current_setting('app.current_org_id', true)::text);

-- Comments
COMMENT ON TABLE service_type_configs IS 'Configurable service types per organization';
COMMENT ON COLUMN service_type_configs.code IS 'Internal code for the service type (uppercase, no spaces)';
COMMENT ON COLUMN service_type_configs.name IS 'Display name shown to users';
COMMENT ON COLUMN service_type_configs.color IS 'Hex color code for UI display (e.g., #FF5733)';
COMMENT ON COLUMN service_type_configs.icon IS 'Icon name for UI display';
