-- Migration: 002_create_organizations
-- Description: Create organizations table
-- Created: 2024-01-15

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cuit TEXT UNIQUE NOT NULL,
    iva_condition iva_condition NOT NULL DEFAULT 'monotributista',

    -- AFIP Configuration (encrypted)
    afip_punto_venta INTEGER,
    afip_cert JSONB,  -- EncryptedData structure
    afip_key JSONB,   -- EncryptedData structure
    afip_cert_expiry DATE,
    afip_homologated BOOLEAN DEFAULT false,

    -- Mercado Pago Configuration (encrypted)
    mp_access_token JSONB,   -- EncryptedData structure
    mp_refresh_token JSONB,  -- EncryptedData structure
    mp_user_id TEXT,
    mp_connected_at TIMESTAMPTZ,

    -- WhatsApp Configuration
    whatsapp_phone_id TEXT,
    whatsapp_business_id TEXT,
    whatsapp_verified BOOLEAN DEFAULT false,

    -- Settings
    settings JSONB DEFAULT '{
        "ui_mode": "simple",
        "auto_invoice_on_complete": true,
        "auto_send_whatsapp": true,
        "voice_auto_create_threshold": 0.7
    }'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_organizations_cuit ON organizations(cuit);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON organizations
    FOR ALL
    USING (id = current_setting('app.current_org_id', true)::uuid);

-- Comments
COMMENT ON TABLE organizations IS 'Multi-tenant organization accounts';
COMMENT ON COLUMN organizations.afip_cert IS 'Encrypted AFIP certificate data';
COMMENT ON COLUMN organizations.mp_access_token IS 'Encrypted Mercado Pago access token';
