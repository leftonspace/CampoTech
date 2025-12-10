-- Migration: 056_create_invoice_items.sql
-- Description: Create invoice_items table to replace JSONB in invoices.line_items
-- Replaces: invoices.line_items JSONB column with normalized table
-- Created: 2025-01-10

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: invoice_items
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS invoice_items (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relations
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    price_book_id UUID REFERENCES price_book(id) ON DELETE SET NULL,

    -- Item Info
    description TEXT NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'unidad',

    -- Pricing
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 21.00,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL,

    -- AFIP Codes
    afip_product_code TEXT,
    afip_unit_code TEXT DEFAULT '7',           -- '7' = Unidad in AFIP

    -- Sort Order
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT invoice_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT invoice_items_unit_price_positive CHECK (unit_price >= 0),
    CONSTRAINT invoice_items_subtotal_positive CHECK (subtotal >= 0),
    CONSTRAINT invoice_items_tax_amount_positive CHECK (tax_amount >= 0),
    CONSTRAINT invoice_items_total_correct CHECK (total = subtotal + tax_amount)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Primary access pattern: items by invoice
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
    ON invoice_items(invoice_id, sort_order);

-- Price book reference for statistics
CREATE INDEX IF NOT EXISTS idx_invoice_items_price_book
    ON invoice_items(price_book_id)
    WHERE price_book_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Items inherit access from their parent invoice
CREATE POLICY invoice_items_org_isolation ON invoice_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_items.invoice_id
            AND invoices.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

-- ══════════════════════════════════════════════════════════════════════════════
-- DATA MIGRATION: Transfer existing line_items from invoices.line_items JSONB
-- ══════════════════════════════════════════════════════════════════════════════

-- Migrate existing line items from invoices.line_items JSONB
DO $$
DECLARE
    invoice_record RECORD;
    item JSONB;
    item_index INTEGER;
BEGIN
    -- Check if line_items column exists in invoices table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'line_items'
    ) THEN
        -- Iterate over invoices with line_items
        FOR invoice_record IN
            SELECT id, line_items
            FROM invoices
            WHERE line_items IS NOT NULL AND jsonb_array_length(line_items) > 0
        LOOP
            item_index := 0;
            -- Iterate over each line item in the JSONB array
            FOR item IN SELECT * FROM jsonb_array_elements(invoice_record.line_items)
            LOOP
                INSERT INTO invoice_items (
                    invoice_id,
                    description,
                    quantity,
                    unit,
                    unit_price,
                    tax_rate,
                    subtotal,
                    tax_amount,
                    total,
                    afip_product_code,
                    afip_unit_code,
                    sort_order,
                    created_at
                )
                VALUES (
                    invoice_record.id,
                    COALESCE(item->>'description', 'Item'),
                    COALESCE((item->>'quantity')::DECIMAL, 1),
                    COALESCE(item->>'unit', 'unidad'),
                    COALESCE((item->>'unitPrice')::DECIMAL, (item->>'unit_price')::DECIMAL, 0),
                    COALESCE((item->>'taxRate')::DECIMAL, (item->>'tax_rate')::DECIMAL, 21.00),
                    COALESCE((item->>'subtotal')::DECIMAL,
                        COALESCE((item->>'quantity')::DECIMAL, 1) * COALESCE((item->>'unitPrice')::DECIMAL, (item->>'unit_price')::DECIMAL, 0)),
                    COALESCE((item->>'taxAmount')::DECIMAL, (item->>'tax_amount')::DECIMAL, 0),
                    COALESCE((item->>'total')::DECIMAL,
                        COALESCE((item->>'subtotal')::DECIMAL, 0) + COALESCE((item->>'taxAmount')::DECIMAL, (item->>'tax_amount')::DECIMAL, 0)),
                    item->>'afipProductCode',
                    COALESCE(item->>'afipUnitCode', '7'),
                    item_index,
                    NOW()
                )
                ON CONFLICT DO NOTHING;

                item_index := item_index + 1;
            END LOOP;
        END LOOP;

        RAISE NOTICE 'Migrated line items from invoices.line_items column to invoice_items table';
    ELSE
        RAISE NOTICE 'invoices.line_items column does not exist, skipping data migration';
    END IF;
END$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTION: Calculate invoice totals from items
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_invoice_totals_from_items(p_invoice_id UUID)
RETURNS TABLE (
    subtotal DECIMAL(12, 2),
    tax_amount DECIMAL(12, 2),
    total DECIMAL(12, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(ii.subtotal), 0)::DECIMAL(12, 2) AS subtotal,
        COALESCE(SUM(ii.tax_amount), 0)::DECIMAL(12, 2) AS tax_amount,
        COALESCE(SUM(ii.total), 0)::DECIMAL(12, 2) AS total
    FROM invoice_items ii
    WHERE ii.invoice_id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE invoice_items IS 'Line items for invoices - AFIP compliant';
COMMENT ON COLUMN invoice_items.price_book_id IS 'Reference to price book item if created from it';
COMMENT ON COLUMN invoice_items.afip_product_code IS 'AFIP product code (NCM) for fiscal compliance';
COMMENT ON COLUMN invoice_items.afip_unit_code IS 'AFIP unit code (7=unidad, 1=kg, etc.)';
COMMENT ON COLUMN invoice_items.sort_order IS 'Display order of items on invoice';
