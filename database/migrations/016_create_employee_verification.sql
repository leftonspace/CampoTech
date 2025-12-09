-- Migration 016: Create employee verification tables
-- Phase 9.5: Employee Onboarding & Verification

-- Employee verification tokens
CREATE TABLE employee_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Verification code
    code TEXT NOT NULL,

    -- Status tracking
    is_used BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,

    -- Cooldown tracking
    last_attempt_at TIMESTAMPTZ,
    cooldown_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add verification fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'whatsapp';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Onboarding checklist tracking
CREATE TABLE onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Checklist items
    phone_verified BOOLEAN DEFAULT false,
    phone_verified_at TIMESTAMPTZ,

    terms_accepted BOOLEAN DEFAULT false,
    terms_accepted_at TIMESTAMPTZ,

    profile_completed BOOLEAN DEFAULT false,
    profile_completed_at TIMESTAMPTZ,

    tutorial_completed BOOLEAN DEFAULT false,
    tutorial_completed_at TIMESTAMPTZ,
    tutorial_skipped BOOLEAN DEFAULT false,

    first_login_at TIMESTAMPTZ,

    -- Completion
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_verification_tokens_user ON employee_verification_tokens(user_id);
CREATE INDEX idx_verification_tokens_code ON employee_verification_tokens(code, user_id);
CREATE INDEX idx_verification_tokens_expiry ON employee_verification_tokens(expires_at) WHERE NOT is_used;
CREATE INDEX idx_onboarding_progress_user ON onboarding_progress(user_id);
CREATE INDEX idx_users_verified ON users(is_verified) WHERE NOT is_verified;

-- RLS Policies
ALTER TABLE employee_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY verification_tokens_org_isolation ON employee_verification_tokens
    USING (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY onboarding_progress_org_isolation ON onboarding_progress
    USING (organization_id = current_setting('app.organization_id', true)::uuid);

-- Trigger for updated_at
CREATE TRIGGER onboarding_progress_updated_at
    BEFORE UPDATE ON onboarding_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
