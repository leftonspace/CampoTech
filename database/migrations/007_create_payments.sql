-- Migration: 007_create_payments
-- Description: Create payments table for Mercado Pago integration
-- Created: 2024-01-15

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,

    -- Mercado Pago
    mp_payment_id TEXT UNIQUE,
    mp_preference_id TEXT,
    mp_external_reference TEXT,

    -- Amounts
    amount DECIMAL(12, 2) NOT NULL,
    refunded_amount DECIMAL(12, 2) DEFAULT 0,
    currency TEXT DEFAULT 'ARS',

    -- Cuotas (installments)
    installments INTEGER DEFAULT 1,
    installment_amount DECIMAL(12, 2),

    -- Status
    status payment_status DEFAULT 'pending',
    status_detail TEXT,

    -- Payment method
    payment_method payment_method,
    payment_type TEXT,

    -- Dispute handling
    dispute_id TEXT,
    dispute_status TEXT,
    dispute_deadline DATE,

    -- Idempotency
    webhook_idempotency_key TEXT UNIQUE,

    -- Timestamps
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_org ON payments(org_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(org_id, status);
CREATE INDEX idx_payments_mp_id ON payments(mp_payment_id);
CREATE INDEX idx_payments_approved ON payments(approved_at);

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_org_isolation ON payments
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Comments
COMMENT ON TABLE payments IS 'Payment records from Mercado Pago';
COMMENT ON COLUMN payments.mp_payment_id IS 'Mercado Pago payment ID';
COMMENT ON COLUMN payments.installments IS 'Number of installments (cuotas)';
