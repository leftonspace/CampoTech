-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION 054: Referral System Tables
-- Phase 15: Consumer Marketplace - Marketing & Growth
-- ════════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────────
-- REFERRAL CODES
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer.referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
  usage_count INTEGER DEFAULT 0,
  total_rewards DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_referral_codes_consumer ON consumer.referral_codes(consumer_id);
CREATE INDEX idx_referral_codes_code ON consumer.referral_codes(code);

-- ────────────────────────────────────────────────────────────────────────────────
-- REFERRAL USES
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer.referral_uses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
  referral_code VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, expired
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(referee_id) -- Each consumer can only be referred once
);

CREATE INDEX idx_referral_uses_referrer ON consumer.referral_uses(referrer_id);
CREATE INDEX idx_referral_uses_referee ON consumer.referral_uses(referee_id);
CREATE INDEX idx_referral_uses_status ON consumer.referral_uses(status);

-- ────────────────────────────────────────────────────────────────────────────────
-- REFERRAL REWARDS
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer.referral_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- referrer, referee
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, earned, paid
  reason VARCHAR(255),
  earned_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_referral_rewards_consumer ON consumer.referral_rewards(consumer_id);
CREATE INDEX idx_referral_rewards_status ON consumer.referral_rewards(status);

-- ════════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ════════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE consumer.referral_codes IS 'Unique referral codes for consumers';
COMMENT ON TABLE consumer.referral_uses IS 'Tracks when referral codes are used';
COMMENT ON TABLE consumer.referral_rewards IS 'Rewards earned through referrals';
