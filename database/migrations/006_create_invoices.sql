-- Migration: 006_create_invoices
-- Description: Create invoices table with AFIP compliance
-- Created: 2024-01-15

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

    -- AFIP identification
    invoice_number INTEGER,
    invoice_type invoice_type NOT NULL,
    punto_venta INTEGER NOT NULL,

    -- AFIP authorization
    cae TEXT,
    cae_expiry DATE,
    qr_data TEXT,

    -- Amounts
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL,
    currency TEXT DEFAULT 'ARS',

    -- Line items
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Status
    status invoice_status DEFAULT 'draft',
    afip_error TEXT,
    afip_attempts INTEGER DEFAULT 0,
    last_afip_attempt TIMESTAMPTZ,

    -- PDF
    pdf_url TEXT,
    pdf_hash TEXT,  -- SHA-256 for immutability

    -- Idempotency
    idempotency_key TEXT UNIQUE,

    -- Timestamps
    issued_at TIMESTAMPTZ,
    due_date DATE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_invoice_number UNIQUE (org_id, punto_venta, invoice_number)
);

-- Indexes
CREATE INDEX idx_invoices_org ON invoices(org_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_job ON invoices(job_id);
CREATE INDEX idx_invoices_status ON invoices(org_id, status);
CREATE INDEX idx_invoices_cae ON invoices(cae) WHERE cae IS NOT NULL;
CREATE INDEX idx_invoices_issued ON invoices(issued_at);

-- Add foreign key to jobs table
ALTER TABLE jobs ADD CONSTRAINT fk_jobs_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- CRITICAL: Prevent modification of fiscal fields after CAE issued
CREATE OR REPLACE FUNCTION prevent_fiscal_field_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.cae IS NOT NULL THEN
        -- CAE exists, check for illegal mutations
        IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number OR
           NEW.invoice_type IS DISTINCT FROM OLD.invoice_type OR
           NEW.punto_venta IS DISTINCT FROM OLD.punto_venta OR
           NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
           NEW.tax_amount IS DISTINCT FROM OLD.tax_amount OR
           NEW.total IS DISTINCT FROM OLD.total OR
           NEW.issued_at IS DISTINCT FROM OLD.issued_at OR
           NEW.cae IS DISTINCT FROM OLD.cae OR
           NEW.cae_expiry IS DISTINCT FROM OLD.cae_expiry OR
           NEW.line_items IS DISTINCT FROM OLD.line_items THEN
            RAISE EXCEPTION 'Cannot modify fiscal fields after CAE issued';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_invoice_immutability
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION prevent_fiscal_field_mutation();

-- Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_org_isolation ON invoices
    FOR ALL
    USING (
        org_id = current_setting('app.current_org_id', true)::uuid
        AND current_setting('app.current_user_role', true) IN ('owner', 'admin', 'dispatcher', 'accountant')
    );

-- Comments
COMMENT ON TABLE invoices IS 'AFIP-compliant electronic invoices';
COMMENT ON COLUMN invoices.cae IS 'AFIP Código de Autorización Electrónico - immutable once set';
COMMENT ON COLUMN invoices.line_items IS 'JSON array of invoice line items';
