-- Migration: 004_create_customers
-- Description: Create customers table
-- Created: 2024-01-15

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identity
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,

    -- Argentina documents (for AFIP)
    doc_type doc_type DEFAULT 'dni',
    doc_number TEXT,
    iva_condition iva_condition DEFAULT 'consumidor_final',

    -- Address
    address TEXT,
    address_extra TEXT,  -- piso, depto
    neighborhood TEXT,   -- Barrio (Palermo, Belgrano, etc.)
    city TEXT DEFAULT 'Buenos Aires',
    province TEXT DEFAULT 'CABA',
    postal_code TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),

    -- WhatsApp
    whatsapp_thread_id TEXT,
    last_message_at TIMESTAMPTZ,

    -- Meta
    notes TEXT,
    tags TEXT[],
    source record_source DEFAULT 'manual',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_customer_phone UNIQUE (org_id, phone)
);

-- Indexes
CREATE INDEX idx_customers_org ON customers(org_id);
CREATE INDEX idx_customers_phone ON customers(org_id, phone);
CREATE INDEX idx_customers_name ON customers(org_id, name);
CREATE INDEX idx_customers_doc ON customers(org_id, doc_type, doc_number);

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_org_isolation ON customers
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Comments
COMMENT ON TABLE customers IS 'Customer records per organization';
COMMENT ON COLUMN customers.iva_condition IS 'Tax condition for AFIP invoice type determination';
