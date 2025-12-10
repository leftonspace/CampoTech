-- Migration: 019_create_customer_portal_auth.sql
-- Description: Create tables for customer portal authentication system
-- Phase: 13.1 - Customer Authentication System

-- ══════════════════════════════════════════════════════════════════════════════
-- CUSTOMER MAGIC LINKS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customer_magic_links (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for magic links
CREATE INDEX IF NOT EXISTS idx_customer_magic_links_token_hash
  ON customer_magic_links(token_hash);

CREATE INDEX IF NOT EXISTS idx_customer_magic_links_email_created
  ON customer_magic_links(email, created_at);

CREATE INDEX IF NOT EXISTS idx_customer_magic_links_expires
  ON customer_magic_links(expires_at)
  WHERE used = FALSE;

COMMENT ON TABLE customer_magic_links IS 'Magic link tokens for customer passwordless authentication';
COMMENT ON COLUMN customer_magic_links.token_hash IS 'SHA-256 hash of the magic link token';
COMMENT ON COLUMN customer_magic_links.metadata IS 'Optional context like returnTo URL, invoice ID, etc.';

-- ══════════════════════════════════════════════════════════════════════════════
-- CUSTOMER OTP CODES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customer_otp_codes (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for OTP codes
CREATE INDEX IF NOT EXISTS idx_customer_otp_codes_phone_org
  ON customer_otp_codes(org_id, phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_otp_codes_expires
  ON customer_otp_codes(expires_at)
  WHERE verified = FALSE;

COMMENT ON TABLE customer_otp_codes IS 'OTP codes for customer phone-based authentication';
COMMENT ON COLUMN customer_otp_codes.code_hash IS 'Scrypt hash of the OTP code (salt$hash format)';
COMMENT ON COLUMN customer_otp_codes.attempts IS 'Number of verification attempts (max 3)';

-- ══════════════════════════════════════════════════════════════════════════════
-- CUSTOMER SESSIONS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customer_sessions (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_info JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revocation_reason VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for customer sessions
CREATE INDEX IF NOT EXISTS idx_customer_sessions_refresh_token
  ON customer_sessions(refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_active
  ON customer_sessions(customer_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires
  ON customer_sessions(expires_at)
  WHERE is_active = TRUE;

COMMENT ON TABLE customer_sessions IS 'Customer authentication sessions with refresh tokens';
COMMENT ON COLUMN customer_sessions.device_info IS 'Device information (platform, browser, etc.)';
COMMENT ON COLUMN customer_sessions.refresh_token_hash IS 'SHA-256 hash of the refresh token';

-- ══════════════════════════════════════════════════════════════════════════════
-- CUSTOMER IMPERSONATION SESSIONS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customer_impersonation_sessions (
  id UUID PRIMARY KEY,
  support_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  actions_performed JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for impersonation sessions
CREATE INDEX IF NOT EXISTS idx_customer_impersonation_support_user
  ON customer_impersonation_sessions(support_user_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_impersonation_customer
  ON customer_impersonation_sessions(customer_id, started_at);

COMMENT ON TABLE customer_impersonation_sessions IS 'Audit trail for support agents viewing customer accounts';
COMMENT ON COLUMN customer_impersonation_sessions.reason IS 'Required reason for the impersonation (audit)';
COMMENT ON COLUMN customer_impersonation_sessions.actions_performed IS 'Array of actions taken during impersonation';

-- ══════════════════════════════════════════════════════════════════════════════
-- ADD COLUMNS TO CUSTOMERS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

-- Add last_login_at column to track customer portal logins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE customers ADD COLUMN last_login_at TIMESTAMPTZ;
    COMMENT ON COLUMN customers.last_login_at IS 'Last customer portal login timestamp';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- CLEANUP FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to cleanup expired magic links
CREATE OR REPLACE FUNCTION cleanup_expired_customer_magic_links()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM customer_magic_links
  WHERE expires_at < NOW() - INTERVAL '1 day';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired OTP codes
CREATE OR REPLACE FUNCTION cleanup_expired_customer_otp_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM customer_otp_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired customer sessions
CREATE OR REPLACE FUNCTION cleanup_expired_customer_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete sessions expired for more than 7 days
  DELETE FROM customer_sessions
  WHERE expires_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_customer_magic_links() IS 'Remove magic links expired more than 1 day ago';
COMMENT ON FUNCTION cleanup_expired_customer_otp_codes() IS 'Remove OTP codes expired more than 1 hour ago';
COMMENT ON FUNCTION cleanup_expired_customer_sessions() IS 'Remove sessions expired more than 7 days ago';
