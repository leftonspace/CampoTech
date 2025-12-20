-- CampoTech Subscription System Migration
-- ==========================================
-- Phase 1.1: Database Schema for Subscription Billing
--
-- Creates tables for:
-- 1. organization_subscriptions - Main subscription records
-- 2. subscription_payments - Payment history
-- 3. subscription_events - Audit log
-- Also adds subscription fields to organizations table

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENUM TYPES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Subscription Tier
DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('FREE', 'INICIAL', 'PROFESIONAL', 'EMPRESA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Subscription Status
DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('none', 'trialing', 'active', 'past_due', 'cancelled', 'expired', 'paused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Subscription Payment Status
DO $$ BEGIN
    CREATE TYPE subscription_payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Billing Cycle
DO $$ BEGIN
    CREATE TYPE billing_cycle AS ENUM ('MONTHLY', 'YEARLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment Type (one-time vs recurring)
DO $$ BEGIN
    CREATE TYPE subscription_payment_type AS ENUM ('initial', 'recurring', 'upgrade', 'downgrade', 'reactivation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- UPDATE ORGANIZATIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add subscription fields to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier NOT NULL DEFAULT 'FREE';

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_status subscription_status NOT NULL DEFAULT 'none';

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS marketplace_visible BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- Index for finding organizations by subscription status
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status
    ON organizations(subscription_status);

-- Index for finding organizations by tier
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_tier
    ON organizations(subscription_tier);

-- Index for trial expiration checks
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at
    ON organizations(trial_ends_at)
    WHERE trial_ends_at IS NOT NULL;

-- Index for marketplace visibility
CREATE INDEX IF NOT EXISTS idx_organizations_marketplace_visible
    ON organizations(marketplace_visible)
    WHERE marketplace_visible = true;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ORGANIZATION SUBSCRIPTIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Subscription Details
    tier subscription_tier NOT NULL,
    billing_cycle billing_cycle NOT NULL DEFAULT 'MONTHLY',
    status subscription_status NOT NULL DEFAULT 'trialing',

    -- Trial Period
    trial_ends_at TIMESTAMPTZ,

    -- Current Billing Period
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,

    -- MercadoPago Integration
    mp_subscription_id TEXT,          -- MercadoPago subscription ID
    mp_payer_id TEXT,                 -- MercadoPago payer ID
    mp_plan_id TEXT,                  -- MercadoPago plan ID

    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,

    -- Grace Period (for past_due status)
    grace_period_ends_at TIMESTAMPTZ,

    -- Pricing (for record keeping)
    price_usd DECIMAL(10, 2),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one active subscription per organization
    CONSTRAINT org_subscriptions_org_id_unique UNIQUE (organization_id)
);

-- Index for finding subscriptions by MP subscription ID
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_mp_subscription_id
    ON organization_subscriptions(mp_subscription_id)
    WHERE mp_subscription_id IS NOT NULL;

-- Index for finding subscriptions by status
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status
    ON organization_subscriptions(status);

-- Index for period end (for renewal processing)
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_period_end
    ON organization_subscriptions(current_period_end);

-- Index for trial expiration
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_trial_ends
    ON organization_subscriptions(trial_ends_at)
    WHERE status = 'trialing' AND trial_ends_at IS NOT NULL;

-- Index for grace period expiration
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_grace_period
    ON organization_subscriptions(grace_period_ends_at)
    WHERE status = 'past_due' AND grace_period_ends_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTION PAYMENTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscription_payments (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Payment Details
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status subscription_payment_status NOT NULL DEFAULT 'pending',
    payment_type subscription_payment_type NOT NULL DEFAULT 'recurring',
    payment_method VARCHAR(50),       -- 'credit_card', 'debit_card', 'transfer', etc.

    -- Billing Period
    billing_cycle billing_cycle NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- MercadoPago Integration
    mp_payment_id TEXT,               -- MercadoPago payment ID
    mp_preference_id TEXT,            -- MercadoPago preference ID
    mp_external_reference TEXT,       -- Our reference sent to MP

    -- Failure Tracking
    failure_reason TEXT,
    failure_code TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,

    -- Success Details
    paid_at TIMESTAMPTZ,
    receipt_url TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding payments by subscription
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id
    ON subscription_payments(subscription_id);

-- Index for finding payments by organization
CREATE INDEX IF NOT EXISTS idx_subscription_payments_organization_id
    ON subscription_payments(organization_id);

-- Index for finding payments by MP payment ID
CREATE INDEX IF NOT EXISTS idx_subscription_payments_mp_payment_id
    ON subscription_payments(mp_payment_id)
    WHERE mp_payment_id IS NOT NULL;

-- Index for finding payments by status
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status
    ON subscription_payments(status);

-- Index for retry processing
CREATE INDEX IF NOT EXISTS idx_subscription_payments_retry
    ON subscription_payments(next_retry_at)
    WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Index for payment date
CREATE INDEX IF NOT EXISTS idx_subscription_payments_paid_at
    ON subscription_payments(paid_at)
    WHERE paid_at IS NOT NULL;

-- Index for created_at (for reporting)
CREATE INDEX IF NOT EXISTS idx_subscription_payments_created_at
    ON subscription_payments(created_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTION EVENTS TABLE (Audit Log)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscription_events (
    id TEXT PRIMARY KEY,
    subscription_id TEXT REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Event Details
    event_type VARCHAR(50) NOT NULL,  -- 'created', 'activated', 'trial_started', 'trial_ended',
                                      -- 'payment_succeeded', 'payment_failed', 'upgraded',
                                      -- 'downgraded', 'cancelled', 'reactivated', 'expired',
                                      -- 'grace_period_started', 'grace_period_ended'
    event_data JSONB NOT NULL DEFAULT '{}',

    -- Actor (who triggered the event)
    actor_type VARCHAR(20),           -- 'user', 'system', 'webhook', 'admin'
    actor_id TEXT,                    -- User ID if actor_type is 'user' or 'admin'

    -- Additional Context
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding events by subscription
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id
    ON subscription_events(subscription_id)
    WHERE subscription_id IS NOT NULL;

-- Index for finding events by organization
CREATE INDEX IF NOT EXISTS idx_subscription_events_organization_id
    ON subscription_events(organization_id);

-- Index for finding events by type
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type
    ON subscription_events(event_type);

-- Index for created_at (for time-based queries)
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at
    ON subscription_events(created_at);

-- Composite index for org + time queries
CREATE INDEX IF NOT EXISTS idx_subscription_events_org_created
    ON subscription_events(organization_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ORGANIZATION SETTINGS TABLE (if not exists)
-- Add MercadoPago subscription fields
-- ═══════════════════════════════════════════════════════════════════════════════

-- Check if organization_settings table exists and add MP subscription fields
DO $$
BEGIN
    -- These columns may already exist from other migrations
    -- MercadoPago subscription plan IDs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_settings') THEN
        BEGIN
            ALTER TABLE organization_settings
            ADD COLUMN IF NOT EXISTS mp_subscription_enabled BOOLEAN NOT NULL DEFAULT false;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: Update updated_at timestamp
-- ═══════════════════════════════════════════════════════════════════════════════

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for organization_subscriptions
DROP TRIGGER IF EXISTS update_org_subscriptions_updated_at ON organization_subscriptions;
CREATE TRIGGER update_org_subscriptions_updated_at
    BEFORE UPDATE ON organization_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for subscription_payments
DROP TRIGGER IF EXISTS update_subscription_payments_updated_at ON subscription_payments;
CREATE TRIGGER update_subscription_payments_updated_at
    BEFORE UPDATE ON subscription_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE organization_subscriptions IS 'Stores subscription records for each organization (one per org)';
COMMENT ON TABLE subscription_payments IS 'Tracks all subscription payment attempts and successes';
COMMENT ON TABLE subscription_events IS 'Audit log of all subscription-related events';

COMMENT ON COLUMN organizations.subscription_tier IS 'Current subscription tier (synced from organization_subscriptions)';
COMMENT ON COLUMN organizations.subscription_status IS 'Current subscription status (synced from organization_subscriptions)';
COMMENT ON COLUMN organizations.trial_ends_at IS 'When the trial period ends (for trialing status)';
COMMENT ON COLUMN organizations.marketplace_visible IS 'Whether this business appears in the marketplace';
COMMENT ON COLUMN organizations.verification_status IS 'Verification status: pending, partial, verified, suspended';

COMMENT ON COLUMN organization_subscriptions.mp_subscription_id IS 'MercadoPago subscription ID for recurring billing';
COMMENT ON COLUMN organization_subscriptions.mp_payer_id IS 'MercadoPago payer ID for the subscriber';
COMMENT ON COLUMN organization_subscriptions.cancel_at_period_end IS 'If true, subscription will cancel at period end instead of immediately';
COMMENT ON COLUMN organization_subscriptions.grace_period_ends_at IS 'End of grace period for past_due subscriptions';

COMMENT ON COLUMN subscription_payments.mp_external_reference IS 'Our external reference sent to MercadoPago for reconciliation';
COMMENT ON COLUMN subscription_payments.next_retry_at IS 'When to retry a failed payment';

COMMENT ON COLUMN subscription_events.actor_type IS 'Who triggered this event: user, system, webhook, or admin';
COMMENT ON COLUMN subscription_events.event_data IS 'JSON data specific to the event type';

-- ═══════════════════════════════════════════════════════════════════════════════
-- BACKFILL: Set existing organizations to FREE tier
-- ═══════════════════════════════════════════════════════════════════════════════

-- All existing organizations start as FREE with no subscription
-- This is already handled by the DEFAULT values, but let's be explicit
UPDATE organizations
SET
    subscription_tier = 'FREE',
    subscription_status = 'none',
    trial_ends_at = NULL,
    marketplace_visible = false,
    verification_status = 'pending'
WHERE subscription_tier IS NULL OR subscription_status IS NULL;
