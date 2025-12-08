-- Migration: 012_create_afip_sequences
-- Description: Create afip_sequences table for invoice numbering
-- Created: 2024-01-15

-- AFIP requires sequential invoice numbers with no gaps
-- This table manages the sequence per org/punto_venta/invoice_type

CREATE TABLE afip_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Sequence identification
    punto_venta INTEGER NOT NULL,
    cbte_tipo INTEGER NOT NULL,  -- 1=A, 6=B, 11=C

    -- Current sequence value
    last_number INTEGER NOT NULL DEFAULT 0,

    -- AFIP sync tracking
    last_afip_sync TIMESTAMPTZ,
    afip_confirmed_number INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT unique_afip_sequence
        UNIQUE (org_id, punto_venta, cbte_tipo)
);

-- Indexes
CREATE INDEX idx_afip_seq_org ON afip_sequences(org_id);

-- Trigger for updated_at
CREATE TRIGGER update_afip_sequences_updated_at
    BEFORE UPDATE ON afip_sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get and increment next invoice number (atomic)
CREATE OR REPLACE FUNCTION get_next_invoice_number(
    p_org_id UUID,
    p_punto_venta INTEGER,
    p_cbte_tipo INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_next_number INTEGER;
BEGIN
    -- Insert or update with returning the new value
    INSERT INTO afip_sequences (org_id, punto_venta, cbte_tipo, last_number)
    VALUES (p_org_id, p_punto_venta, p_cbte_tipo, 1)
    ON CONFLICT (org_id, punto_venta, cbte_tipo)
    DO UPDATE SET
        last_number = afip_sequences.last_number + 1,
        updated_at = NOW()
    RETURNING last_number INTO v_next_number;

    RETURN v_next_number;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE afip_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY afip_seq_org_isolation ON afip_sequences
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Comments
COMMENT ON TABLE afip_sequences IS 'AFIP invoice number sequences - NEVER decrement';
COMMENT ON COLUMN afip_sequences.cbte_tipo IS 'AFIP comprobante type: 1=A, 6=B, 11=C';
COMMENT ON FUNCTION get_next_invoice_number IS 'Atomically get and reserve next invoice number';
