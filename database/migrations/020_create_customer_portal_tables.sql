-- Migration: 020_create_customer_portal_tables.sql
-- Description: Create tables for customer portal backend (booking, support, feedback, payments)
-- Phase: 13.2 - Customer Portal Backend

-- ══════════════════════════════════════════════════════════════════════════════
-- CUSTOMER BOOKINGS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TYPE booking_status AS ENUM (
  'pending',
  'confirmed',
  'deposit_required',
  'cancelled',
  'completed',
  'expired'
);

CREATE TABLE IF NOT EXISTS customer_bookings (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  service_type_id UUID,
  service_type_name VARCHAR(255) NOT NULL,
  requested_date_time TIMESTAMPTZ NOT NULL,
  confirmed_date_time TIMESTAMPTZ,
  address TEXT NOT NULL,
  city VARCHAR(100),
  province VARCHAR(100),
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  description TEXT,
  notes TEXT,
  status booking_status DEFAULT 'pending',
  estimated_price DECIMAL(12, 2),
  deposit_amount DECIMAL(12, 2) DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT FALSE,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_bookings_customer
  ON customer_bookings(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_bookings_org_date
  ON customer_bookings(org_id, requested_date_time);

CREATE INDEX IF NOT EXISTS idx_customer_bookings_status
  ON customer_bookings(status, requested_date_time)
  WHERE status IN ('pending', 'deposit_required');

COMMENT ON TABLE customer_bookings IS 'Customer self-service booking requests';

-- ══════════════════════════════════════════════════════════════════════════════
-- SUPPORT TICKETS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TYPE ticket_status AS ENUM (
  'open',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed'
);

CREATE TYPE ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE ticket_category AS ENUM (
  'general',
  'billing',
  'service',
  'complaint',
  'feedback',
  'other'
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_number VARCHAR(20) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  category ticket_category NOT NULL,
  priority ticket_priority DEFAULT 'medium',
  status ticket_status DEFAULT 'open',
  related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  related_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_customer
  ON support_tickets(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org_status
  ON support_tickets(org_id, status, priority);

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned
  ON support_tickets(assigned_to_id)
  WHERE status IN ('open', 'in_progress');

COMMENT ON TABLE support_tickets IS 'Customer support tickets';

-- ══════════════════════════════════════════════════════════════════════════════
-- TICKET MESSAGES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type VARCHAR(20) NOT NULL CHECK (author_type IN ('customer', 'staff')),
  author_id UUID NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket
  ON ticket_messages(ticket_id, created_at);

COMMENT ON TABLE ticket_messages IS 'Messages within support tickets';

-- ══════════════════════════════════════════════════════════════════════════════
-- JOB FEEDBACK
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_feedback (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  service_quality INTEGER CHECK (service_quality >= 1 AND service_quality <= 5),
  punctuality INTEGER CHECK (punctuality >= 1 AND punctuality <= 5),
  professionalism INTEGER CHECK (professionalism >= 1 AND professionalism <= 5),
  value_for_money INTEGER CHECK (value_for_money >= 1 AND value_for_money <= 5),
  would_recommend BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_feedback_job
  ON job_feedback(job_id);

CREATE INDEX IF NOT EXISTS idx_job_feedback_customer
  ON job_feedback(customer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_job_feedback_technician
  ON job_feedback(technician_id, rating);

CREATE INDEX IF NOT EXISTS idx_job_feedback_public
  ON job_feedback(org_id, is_public, rating)
  WHERE is_public = TRUE AND rating >= 4;

COMMENT ON TABLE job_feedback IS 'Customer feedback and ratings for completed jobs';

-- ══════════════════════════════════════════════════════════════════════════════
-- CUSTOMER PAYMENT METHODS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('card', 'bank_account')),
  provider VARCHAR(50) NOT NULL,
  external_token TEXT,
  last_four_digits VARCHAR(4),
  brand VARCHAR(50),
  expiration_month INTEGER,
  expiration_year INTEGER,
  holder_name VARCHAR(255),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer
  ON customer_payment_methods(customer_id, is_default);

COMMENT ON TABLE customer_payment_methods IS 'Saved payment methods for customers';

-- ══════════════════════════════════════════════════════════════════════════════
-- BOOKING RULES (per organization)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS booking_rules (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  allowed_service_types TEXT[] DEFAULT '{}',
  min_lead_time_hours INTEGER DEFAULT 24,
  max_advance_booking_days INTEGER DEFAULT 30,
  business_hours JSONB DEFAULT '{}',
  blocked_dates TEXT[] DEFAULT '{}',
  allowed_zones TEXT[] DEFAULT '{}',
  max_bookings_per_slot INTEGER DEFAULT 3,
  slot_duration_minutes INTEGER DEFAULT 120,
  buffer_minutes INTEGER DEFAULT 30,
  require_phone_verification BOOLEAN DEFAULT FALSE,
  require_email_verification BOOLEAN DEFAULT FALSE,
  max_pending_bookings INTEGER DEFAULT 3,
  require_deposit BOOLEAN DEFAULT FALSE,
  deposit_percentage INTEGER DEFAULT 0,
  allowed_payment_methods TEXT[] DEFAULT ARRAY['mercadopago', 'cash', 'transfer'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE booking_rules IS 'Self-service booking configuration per organization';

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_portal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_customer_bookings_timestamp
  BEFORE UPDATE ON customer_bookings
  FOR EACH ROW EXECUTE FUNCTION update_customer_portal_timestamp();

CREATE TRIGGER update_support_tickets_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_customer_portal_timestamp();

CREATE TRIGGER update_booking_rules_timestamp
  BEFORE UPDATE ON booking_rules
  FOR EACH ROW EXECUTE FUNCTION update_customer_portal_timestamp();

-- Function to expire old pending bookings
CREATE OR REPLACE FUNCTION expire_pending_bookings()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE customer_bookings
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('pending', 'deposit_required')
    AND requested_date_time < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_pending_bookings() IS 'Mark old pending bookings as expired';
