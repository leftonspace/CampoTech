-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION 053: Mode Switch and Leads Tables
-- Phase 15: Consumer Marketplace
-- ════════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────────
-- MODE PREFERENCES
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer.mode_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID,
  preferred_mode VARCHAR(20) NOT NULL DEFAULT 'consumer',
  last_switched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  auto_switch_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mode_preferences_phone ON consumer.mode_preferences(phone);

-- ────────────────────────────────────────────────────────────────────────────────
-- MODE SWITCH LOGS
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer.mode_switch_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  target_mode VARCHAR(20) NOT NULL,
  switched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mode_switch_logs_phone ON consumer.mode_switch_logs(phone);
CREATE INDEX idx_mode_switch_logs_switched_at ON consumer.mode_switch_logs(switched_at);

-- ────────────────────────────────────────────────────────────────────────────────
-- PROFILE LINKS (Consumer <-> Business)
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer.profile_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(consumer_id, business_profile_id)
);

-- ────────────────────────────────────────────────────────────────────────────────
-- UPSELL TRACKING
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer.upsell_shown (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'business', 'subscription'
  shown_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_upsell_shown_consumer ON consumer.upsell_shown(consumer_id, type);

-- ────────────────────────────────────────────────────────────────────────────────
-- LEAD VIEWS
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer.lead_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_request_id UUID NOT NULL REFERENCES consumer.service_requests(id) ON DELETE CASCADE,
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_request_id, business_profile_id)
);

CREATE INDEX idx_lead_views_request ON consumer.lead_views(service_request_id);
CREATE INDEX idx_lead_views_business ON consumer.lead_views(business_profile_id);

-- ────────────────────────────────────────────────────────────────────────────────
-- JOBS (Consumer marketplace jobs from accepted quotes)
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_request_id UUID NOT NULL REFERENCES consumer.service_requests(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES consumer.quotes(id) ON DELETE CASCADE,
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  job_number VARCHAR(20) UNIQUE,

  -- Scheduling
  scheduled_date DATE,
  scheduled_time VARCHAR(20),

  -- Status
  status VARCHAR(30) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled

  -- Timeline
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_jobs_service_request ON consumer.jobs(service_request_id);
CREATE INDEX idx_jobs_business ON consumer.jobs(business_profile_id);
CREATE INDEX idx_jobs_status ON consumer.jobs(status);

-- Generate job number sequence
CREATE SEQUENCE IF NOT EXISTS consumer.job_number_seq START 1;

-- Auto-generate job number
CREATE OR REPLACE FUNCTION consumer.generate_job_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_number IS NULL THEN
    NEW.job_number := 'J' || LPAD(nextval('consumer.job_number_seq')::text, 8, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_job_number
  BEFORE INSERT ON consumer.jobs
  FOR EACH ROW
  EXECUTE FUNCTION consumer.generate_job_number();

-- ────────────────────────────────────────────────────────────────────────────────
-- JOB TIMELINE EVENTS
-- ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumer.job_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES consumer.jobs(id) ON DELETE CASCADE,

  event_type VARCHAR(50) NOT NULL, -- status_change, message, photo, note, schedule
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,

  created_by VARCHAR(20) NOT NULL, -- consumer, business
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_timeline_job ON consumer.job_timeline(job_id);

-- ────────────────────────────────────────────────────────────────────────────────
-- ADD accepted_quote_id TO SERVICE REQUESTS
-- ────────────────────────────────────────────────────────────────────────────────

ALTER TABLE consumer.service_requests
ADD COLUMN IF NOT EXISTS accepted_quote_id UUID REFERENCES consumer.quotes(id),
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(20);

-- ────────────────────────────────────────────────────────────────────────────────
-- ADD owner_phone TO BUSINESS PROFILES
-- ────────────────────────────────────────────────────────────────────────────────

ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_business_profiles_owner_phone ON business_profiles(owner_phone);

-- ════════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ════════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE consumer.mode_preferences IS 'User preferences for app mode (consumer vs business)';
COMMENT ON TABLE consumer.mode_switch_logs IS 'Analytics log for mode switches';
COMMENT ON TABLE consumer.profile_links IS 'Links between consumer and business profiles';
COMMENT ON TABLE consumer.lead_views IS 'Tracks which leads businesses have viewed';
COMMENT ON TABLE consumer.jobs IS 'Jobs created from accepted quotes';
COMMENT ON TABLE consumer.job_timeline IS 'Timeline events for job progress tracking';
