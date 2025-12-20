-- CampoTech Verification & Compliance System Migration
-- =====================================================
-- Phase 1.2: Database Schema for Verification & Compliance
--
-- Creates tables for:
-- 1. verification_requirements - Master list of all verification requirements
-- 2. verification_submissions - User/organization submissions
-- 3. verification_reminders - Notification tracking
-- 4. compliance_acknowledgments - Legal agreements
-- 5. compliance_blocks - Access blocking records
-- Also updates organizations and users tables

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENUM TYPES FOR VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Verification Category
DO $$ BEGIN
    CREATE TYPE verification_category AS ENUM ('identity', 'business', 'professional', 'insurance', 'background', 'financial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Verification Applies To
DO $$ BEGIN
    CREATE TYPE verification_applies_to AS ENUM ('organization', 'owner', 'employee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Verification Submission Status
DO $$ BEGIN
    CREATE TYPE verification_submission_status AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Reminder Type
DO $$ BEGIN
    CREATE TYPE reminder_type AS ENUM ('expiring_soon', 'expired', 'action_required', 'renewal_due');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Notification Channel
DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('email', 'in_app', 'sms', 'whatsapp');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Acknowledgment Type
DO $$ BEGIN
    CREATE TYPE acknowledgment_type AS ENUM ('terms_of_service', 'verification_responsibility', 'employee_responsibility', 'data_accuracy', 'update_obligation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Block Type
DO $$ BEGIN
    CREATE TYPE compliance_block_type AS ENUM ('soft_block', 'hard_block');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Verified By
DO $$ BEGIN
    CREATE TYPE verified_by_type AS ENUM ('auto', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User Verification Status (simpler than org)
DO $$ BEGIN
    CREATE TYPE user_verification_status AS ENUM ('pending', 'verified', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- UPDATE ORGANIZATIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Note: verification_status and marketplace_visible were added in previous migration
-- Add remaining verification fields

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS verification_completed_at TIMESTAMPTZ;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS can_receive_jobs BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS compliance_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS last_compliance_check TIMESTAMPTZ;

-- Index for finding organizations that can receive jobs
CREATE INDEX IF NOT EXISTS idx_organizations_can_receive_jobs
    ON organizations(can_receive_jobs)
    WHERE can_receive_jobs = true;

-- Index for compliance checks
CREATE INDEX IF NOT EXISTS idx_organizations_last_compliance_check
    ON organizations(last_compliance_check);

-- ═══════════════════════════════════════════════════════════════════════════════
-- UPDATE USERS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE users
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'pending';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS verification_completed_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS can_be_assigned_jobs BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT false;

-- Index for finding verified users
CREATE INDEX IF NOT EXISTS idx_users_verification_status
    ON users(verification_status);

-- Index for finding users who can be assigned jobs
CREATE INDEX IF NOT EXISTS idx_users_can_be_assigned_jobs
    ON users(can_be_assigned_jobs)
    WHERE can_be_assigned_jobs = true;

-- Index for identity verified users
CREATE INDEX IF NOT EXISTS idx_users_identity_verified
    ON users(identity_verified)
    WHERE identity_verified = true;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION REQUIREMENTS TABLE (Master List)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS verification_requirements (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,

    -- Classification
    category verification_category NOT NULL,
    applies_to verification_applies_to NOT NULL,
    tier INTEGER NOT NULL DEFAULT 2,

    -- Requirement Settings
    is_required BOOLEAN NOT NULL DEFAULT true,
    requires_document BOOLEAN NOT NULL DEFAULT false,
    requires_expiration BOOLEAN NOT NULL DEFAULT false,
    auto_verify_source TEXT,              -- 'afip', 'sms', 'email', null for manual

    -- Renewal & Reminders
    renewal_period_days INTEGER,          -- null means no renewal needed
    reminder_days_before INTEGER[] DEFAULT '{30,14,7,1}',
    grace_period_days INTEGER DEFAULT 7,

    -- Badge Display (for Tier 4 optional badges)
    badge_icon TEXT,                      -- Icon name for badge
    badge_label TEXT,                     -- Display label for badge

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding requirements by tier
CREATE INDEX IF NOT EXISTS idx_verification_requirements_tier
    ON verification_requirements(tier);

-- Index for finding requirements by applies_to
CREATE INDEX IF NOT EXISTS idx_verification_requirements_applies_to
    ON verification_requirements(applies_to);

-- Index for active requirements
CREATE INDEX IF NOT EXISTS idx_verification_requirements_active
    ON verification_requirements(is_active)
    WHERE is_active = true;

-- Index for display ordering
CREATE INDEX IF NOT EXISTS idx_verification_requirements_display_order
    ON verification_requirements(display_order);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION SUBMISSIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS verification_submissions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    requirement_id TEXT NOT NULL REFERENCES verification_requirements(id),

    -- Submission Status
    status verification_submission_status NOT NULL DEFAULT 'pending',

    -- Submitted Data
    submitted_value TEXT,                 -- For text values like CUIT
    document_url TEXT,                    -- For uploaded documents
    document_type TEXT,                   -- MIME type or document classification
    document_filename TEXT,               -- Original filename

    -- Verification
    verified_at TIMESTAMPTZ,
    verified_by verified_by_type,
    verified_by_user_id TEXT,             -- Admin user ID if manual verification
    rejection_reason TEXT,
    rejection_code TEXT,                  -- For categorized rejections

    -- Expiration
    expires_at DATE,
    expiry_notified_at TIMESTAMPTZ,       -- When last expiry notification was sent

    -- Auto-verification
    auto_verify_response JSONB,           -- Response from AFIP or other auto-verify source
    auto_verify_checked_at TIMESTAMPTZ,

    -- Notes
    notes TEXT,
    admin_notes TEXT,                     -- Internal notes for admins

    -- Timestamps
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding submissions by organization
CREATE INDEX IF NOT EXISTS idx_verification_submissions_org
    ON verification_submissions(organization_id);

-- Index for finding submissions by user
CREATE INDEX IF NOT EXISTS idx_verification_submissions_user
    ON verification_submissions(user_id)
    WHERE user_id IS NOT NULL;

-- Index for finding submissions by requirement
CREATE INDEX IF NOT EXISTS idx_verification_submissions_requirement
    ON verification_submissions(requirement_id);

-- Index for finding submissions by status
CREATE INDEX IF NOT EXISTS idx_verification_submissions_status
    ON verification_submissions(status);

-- Index for finding expiring submissions
CREATE INDEX IF NOT EXISTS idx_verification_submissions_expires
    ON verification_submissions(expires_at)
    WHERE expires_at IS NOT NULL;

-- Composite index for org + requirement (common lookup)
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_submissions_org_req
    ON verification_submissions(organization_id, requirement_id, user_id)
    WHERE user_id IS NOT NULL;

-- Composite index for org-level submissions (no user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_submissions_org_req_no_user
    ON verification_submissions(organization_id, requirement_id)
    WHERE user_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION REMINDERS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS verification_reminders (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES verification_submissions(id) ON DELETE CASCADE,
    recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Reminder Details
    reminder_type reminder_type NOT NULL,
    days_until_expiry INTEGER,
    channel notification_channel NOT NULL,

    -- Status
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,               -- If they clicked a link in the reminder

    -- For tracking
    message_id TEXT,                      -- External ID (email/SMS ID)
    error_message TEXT                    -- If sending failed
);

-- Index for finding reminders by submission
CREATE INDEX IF NOT EXISTS idx_verification_reminders_submission
    ON verification_reminders(submission_id);

-- Index for finding reminders by recipient
CREATE INDEX IF NOT EXISTS idx_verification_reminders_recipient
    ON verification_reminders(recipient_user_id);

-- Index for finding recent reminders (to avoid duplicates)
CREATE INDEX IF NOT EXISTS idx_verification_reminders_sent
    ON verification_reminders(sent_at);

-- Composite index to check if reminder was already sent
CREATE INDEX IF NOT EXISTS idx_verification_reminders_dedup
    ON verification_reminders(submission_id, reminder_type, days_until_expiry, channel);

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMPLIANCE ACKNOWLEDGMENTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS compliance_acknowledgments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Acknowledgment Details
    acknowledgment_type acknowledgment_type NOT NULL,
    version TEXT NOT NULL,                -- Version of the agreement (e.g., "1.0", "2024-01")

    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info JSONB,                    -- Additional device info

    -- Timestamp
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding acknowledgments by user
CREATE INDEX IF NOT EXISTS idx_compliance_acknowledgments_user
    ON compliance_acknowledgments(user_id);

-- Index for finding acknowledgments by organization
CREATE INDEX IF NOT EXISTS idx_compliance_acknowledgments_org
    ON compliance_acknowledgments(organization_id);

-- Index for finding acknowledgments by type
CREATE INDEX IF NOT EXISTS idx_compliance_acknowledgments_type
    ON compliance_acknowledgments(acknowledgment_type);

-- Unique index to prevent duplicate acknowledgments of same version
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_acknowledgments_unique
    ON compliance_acknowledgments(user_id, acknowledgment_type, version);

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMPLIANCE BLOCKS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS compliance_blocks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,

    -- Block Details
    block_type compliance_block_type NOT NULL,
    reason TEXT NOT NULL,
    reason_code TEXT,                     -- Categorized reason code

    -- Related Submission (if block is due to verification issue)
    related_submission_id TEXT REFERENCES verification_submissions(id) ON DELETE SET NULL,

    -- Timestamps
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unblocked_at TIMESTAMPTZ,
    unblocked_by TEXT,                    -- User ID of admin who unblocked
    unblock_reason TEXT,

    -- For tracking
    created_by TEXT,                      -- System or admin user ID
    notes TEXT
);

-- Index for finding blocks by organization
CREATE INDEX IF NOT EXISTS idx_compliance_blocks_org
    ON compliance_blocks(organization_id);

-- Index for finding blocks by user
CREATE INDEX IF NOT EXISTS idx_compliance_blocks_user
    ON compliance_blocks(user_id)
    WHERE user_id IS NOT NULL;

-- Index for finding active blocks
CREATE INDEX IF NOT EXISTS idx_compliance_blocks_active
    ON compliance_blocks(organization_id, user_id)
    WHERE unblocked_at IS NULL;

-- Index for finding blocks by type
CREATE INDEX IF NOT EXISTS idx_compliance_blocks_type
    ON compliance_blocks(block_type);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Trigger for verification_submissions updated_at
DROP TRIGGER IF EXISTS update_verification_submissions_updated_at ON verification_submissions;
CREATE TRIGGER update_verification_submissions_updated_at
    BEFORE UPDATE ON verification_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE verification_requirements IS 'Master list of all verification requirements with their settings';
COMMENT ON TABLE verification_submissions IS 'Submissions of verification documents/data from users and organizations';
COMMENT ON TABLE verification_reminders IS 'Tracking of expiration and action reminders sent to users';
COMMENT ON TABLE compliance_acknowledgments IS 'Legal acknowledgments and agreements accepted by users';
COMMENT ON TABLE compliance_blocks IS 'Records of access blocks due to compliance issues';

COMMENT ON COLUMN verification_requirements.tier IS 'Tier 2 = Required for business, Tier 3 = Required for employees, Tier 4 = Optional badges';
COMMENT ON COLUMN verification_requirements.auto_verify_source IS 'Source for automatic verification: afip, sms, email, or null for manual';
COMMENT ON COLUMN verification_requirements.renewal_period_days IS 'Days until document/verification expires and needs renewal';
COMMENT ON COLUMN verification_requirements.reminder_days_before IS 'Array of days before expiry to send reminders';

COMMENT ON COLUMN verification_submissions.verified_by IS 'auto = automatic verification, admin = manual admin review';
COMMENT ON COLUMN verification_submissions.auto_verify_response IS 'JSON response from automatic verification service';

COMMENT ON COLUMN compliance_blocks.block_type IS 'soft_block = limited access, hard_block = no access';

COMMENT ON COLUMN users.verification_status IS 'pending = not verified, verified = fully verified, suspended = verification suspended';
COMMENT ON COLUMN users.can_be_assigned_jobs IS 'Whether this user can be assigned to jobs (depends on verification)';
COMMENT ON COLUMN users.identity_verified IS 'Whether identity documents have been verified';

COMMENT ON COLUMN organizations.can_receive_jobs IS 'Whether this organization can receive new jobs from marketplace';
COMMENT ON COLUMN organizations.compliance_score IS 'Overall compliance score 0-100 based on verifications';
COMMENT ON COLUMN organizations.last_compliance_check IS 'When compliance status was last recalculated';

-- ═══════════════════════════════════════════════════════════════════════════════
-- BACKFILL EXISTING DATA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Set all existing users to pending verification
UPDATE users
SET
    verification_status = 'pending',
    can_be_assigned_jobs = false,
    identity_verified = false
WHERE verification_status IS NULL;

-- Set all existing organizations verification fields
UPDATE organizations
SET
    can_receive_jobs = false,
    compliance_score = 0
WHERE can_receive_jobs IS NULL;
