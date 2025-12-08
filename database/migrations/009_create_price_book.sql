-- Migration: 009_create_price_book
-- Description: Create price_book table for service pricing
-- Created: 2024-01-15

CREATE TABLE price_book (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Item info
    name TEXT NOT NULL,
    description TEXT,
    category pricebook_category NOT NULL,
    service_type job_type,

    -- Pricing
    base_price DECIMAL(12, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 21.00,
    includes_tax BOOLEAN DEFAULT false,

    -- Regional pricing
    region_prices JSONB DEFAULT '{}'::jsonb,  -- {"CABA": 15000, "GBA": 12000}
    complexity_multipliers JSONB DEFAULT '{}'::jsonb,  -- {"simple": 0.8, "normal": 1.0, "complex": 1.5}

    -- AFIP
    afip_product_code TEXT,
    afip_unit_code TEXT DEFAULT '7',  -- unidad

    -- Meta
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pricebook_org ON price_book(org_id);
CREATE INDEX idx_pricebook_category ON price_book(org_id, category);
CREATE INDEX idx_pricebook_active ON price_book(org_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER update_price_book_updated_at
    BEFORE UPDATE ON price_book
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE price_book ENABLE ROW LEVEL SECURITY;

CREATE POLICY pricebook_org_isolation ON price_book
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Comments
COMMENT ON TABLE price_book IS 'Service and material pricing catalog';
COMMENT ON COLUMN price_book.region_prices IS 'JSON object with region-specific prices';
