-- CampoTech Auth Security Tables Migration
-- ==========================================
-- OWASP A07:2021 - Identification and Authentication Failures
--
-- Adds tables for:
-- 1. Refresh tokens (with rotation support)
-- 2. Login attempt tracking
-- 3. Account lockouts

-- ═══════════════════════════════════════════════════════════════════════════════
-- REFRESH TOKENS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash)
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash) WHERE revoked = false;

-- Index for user token management
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at) WHERE revoked = false;

-- ═══════════════════════════════════════════════════════════════════════════════
-- LOGIN ATTEMPTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL,
    identifier_type VARCHAR(20) NOT NULL, -- 'phone', 'email', 'user_id'
    success BOOLEAN NOT NULL DEFAULT false,
    ip_address VARCHAR(45),
    user_agent TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT login_attempts_identifier_type_check
        CHECK (identifier_type IN ('phone', 'email', 'user_id'))
);

-- Index for counting failed attempts (used for lockout check)
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_created
    ON login_attempts(identifier, identifier_type, created_at DESC)
    WHERE success = false;

-- Index for user login history
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id) WHERE user_id IS NOT NULL;

-- Index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LOGIN LOCKOUTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS login_lockouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL,
    identifier_type VARCHAR(20) NOT NULL, -- 'phone', 'email', 'user_id'
    locked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT login_lockouts_identifier_unique
        UNIQUE (identifier, identifier_type),
    CONSTRAINT login_lockouts_identifier_type_check
        CHECK (identifier_type IN ('phone', 'email', 'user_id'))
);

-- Index for active lockout check
CREATE INDEX IF NOT EXISTS idx_login_lockouts_active
    ON login_lockouts(identifier, identifier_type, locked_until)
    WHERE locked_until > NOW();

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for JWT token rotation (OWASP A07:2021)';
COMMENT ON TABLE login_attempts IS 'Tracks login attempts for security monitoring and lockout (OWASP A07:2021)';
COMMENT ON TABLE login_lockouts IS 'Temporary account lockouts after failed login attempts (OWASP A07:2021)';

COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hash of the refresh token (never store plaintext)';
COMMENT ON COLUMN refresh_tokens.revoked IS 'True if token has been explicitly revoked or rotated';
COMMENT ON COLUMN login_attempts.identifier IS 'Phone number, email, or user ID used in login attempt';
COMMENT ON COLUMN login_attempts.identifier_type IS 'Type of identifier: phone, email, or user_id';
COMMENT ON COLUMN login_lockouts.locked_until IS 'Timestamp when the lockout expires';
