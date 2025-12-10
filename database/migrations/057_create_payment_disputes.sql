-- Migration: 057_create_payment_disputes.sql
-- Description: Create payment_disputes table to replace inline columns in payments
-- Replaces: payments.dispute_id, payments.dispute_status, payments.dispute_deadline columns
-- Created: 2025-01-10

-- ══════════════════════════════════════════════════════════════════════════════
-- ENUMS: dispute_type and dispute_status
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_type') THEN
        CREATE TYPE dispute_type AS ENUM (
            'chargeback',
            'fraud_claim',
            'service_not_received',
            'duplicate_charge',
            'product_not_as_described',
            'cancelled_transaction',
            'other'
        );
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
        CREATE TYPE dispute_status AS ENUM (
            'pending_response',
            'evidence_submitted',
            'under_review',
            'escalated',
            'won',
            'lost',
            'withdrawn'
        );
    END IF;
END$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: payment_disputes
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_disputes (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relations
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

    -- Mercado Pago Reference
    mp_dispute_id TEXT,                   -- Mercado Pago dispute ID

    -- Dispute Info
    dispute_type dispute_type NOT NULL,
    reason TEXT,
    description TEXT,

    -- Status
    status dispute_status NOT NULL DEFAULT 'pending_response',

    -- Deadline
    response_deadline TIMESTAMPTZ,
    days_to_respond INTEGER,

    -- Evidence Submission
    evidence_submitted_at TIMESTAMPTZ,
    evidence_urls TEXT[],
    evidence_notes TEXT,
    evidence_documents JSONB,             -- Array of {type, url, description}

    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    resolution_type TEXT,                 -- 'favor_merchant', 'favor_customer', 'split'

    -- Amounts
    disputed_amount DECIMAL(12, 2) NOT NULL,
    recovered_amount DECIMAL(12, 2),

    -- Communication
    last_communication_at TIMESTAMPTZ,
    communication_log JSONB DEFAULT '[]', -- Array of {date, direction, message}

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Primary access pattern: disputes by payment
CREATE INDEX IF NOT EXISTS idx_payment_disputes_payment
    ON payment_disputes(payment_id);

-- MP dispute ID for webhook lookups
CREATE INDEX IF NOT EXISTS idx_payment_disputes_mp_id
    ON payment_disputes(mp_dispute_id)
    WHERE mp_dispute_id IS NOT NULL;

-- Pending disputes with deadlines (for monitoring/alerts)
CREATE INDEX IF NOT EXISTS idx_payment_disputes_deadline
    ON payment_disputes(response_deadline)
    WHERE status = 'pending_response';

-- Active disputes by status
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status
    ON payment_disputes(status, created_at);

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- Updated_at trigger
CREATE TRIGGER update_payment_disputes_updated_at
    BEFORE UPDATE ON payment_disputes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

-- Disputes inherit access from their parent payment
CREATE POLICY payment_disputes_org_isolation ON payment_disputes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM payments
            WHERE payments.id = payment_disputes.payment_id
            AND payments.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to get pending disputes approaching deadline
CREATE OR REPLACE FUNCTION get_urgent_disputes(p_org_id UUID, p_days_threshold INTEGER DEFAULT 3)
RETURNS TABLE (
    dispute_id UUID,
    payment_id UUID,
    dispute_type dispute_type,
    disputed_amount DECIMAL(12, 2),
    response_deadline TIMESTAMPTZ,
    hours_remaining DECIMAL(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pd.id AS dispute_id,
        pd.payment_id,
        pd.dispute_type,
        pd.disputed_amount,
        pd.response_deadline,
        EXTRACT(EPOCH FROM (pd.response_deadline - NOW())) / 3600 AS hours_remaining
    FROM payment_disputes pd
    JOIN payments p ON p.id = pd.payment_id
    WHERE p.org_id = p_org_id
        AND pd.status = 'pending_response'
        AND pd.response_deadline IS NOT NULL
        AND pd.response_deadline <= NOW() + (p_days_threshold || ' days')::INTERVAL
    ORDER BY pd.response_deadline ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to log communication
CREATE OR REPLACE FUNCTION log_dispute_communication(
    p_dispute_id UUID,
    p_direction TEXT,
    p_message TEXT
)
RETURNS void AS $$
BEGIN
    UPDATE payment_disputes
    SET
        communication_log = COALESCE(communication_log, '[]'::JSONB) || jsonb_build_object(
            'date', NOW(),
            'direction', p_direction,
            'message', p_message
        ),
        last_communication_at = NOW(),
        updated_at = NOW()
    WHERE id = p_dispute_id;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE payment_disputes IS 'Payment disputes (chargebacks, fraud claims) from Mercado Pago';
COMMENT ON COLUMN payment_disputes.mp_dispute_id IS 'Mercado Pago dispute ID for API integration';
COMMENT ON COLUMN payment_disputes.evidence_urls IS 'Array of URLs to uploaded evidence documents';
COMMENT ON COLUMN payment_disputes.response_deadline IS 'Deadline to submit evidence/response';
COMMENT ON COLUMN payment_disputes.recovered_amount IS 'Amount recovered after dispute resolution';
COMMENT ON COLUMN payment_disputes.communication_log IS 'JSON array of communications with payment provider';
