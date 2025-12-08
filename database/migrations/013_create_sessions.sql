-- Migration: 013_create_sessions
-- Description: Create sessions and refresh_tokens tables
-- Created: 2024-01-15

-- Sessions table for tracking active sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Session metadata
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,

    -- Tokens
    refresh_token_hash TEXT UNIQUE NOT NULL,

    -- Status
    is_active BOOLEAN DEFAULT true,
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,

    -- Timestamps
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OTP codes for phone verification
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,

    -- OTP data
    code_hash TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,

    -- Status
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,

    -- Timestamps
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_refresh ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE is_active = true;
CREATE INDEX idx_otp_phone ON otp_codes(phone, created_at DESC);
CREATE INDEX idx_otp_expires ON otp_codes(expires_at);

-- Cleanup function for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE sessions
    SET is_active = false, revoke_reason = 'expired'
    WHERE is_active = true AND expires_at < NOW();

    DELETE FROM otp_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE sessions IS 'Active user sessions with refresh tokens';
COMMENT ON TABLE otp_codes IS 'Phone OTP verification codes';
COMMENT ON COLUMN sessions.refresh_token_hash IS 'SHA-256 hash of refresh token';
