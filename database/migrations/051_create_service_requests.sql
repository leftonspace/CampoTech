-- Migration: 051_create_service_requests.sql
-- Description: Create service requests and quotes tables for marketplace (Phase 15.1)
-- Phase: 15 - Consumer Marketplace (Free Service Finder)
-- Created: 2025-01-10

-- ══════════════════════════════════════════════════════════════════════════════
-- CONSUMER SERVICE REQUESTS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS consumer_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumer_profiles(id) ON DELETE CASCADE,

  -- Request number (human-readable)
  request_number TEXT NOT NULL UNIQUE,

  -- What they need
  category service_category NOT NULL,
  service_type TEXT,                    -- 'installation', 'repair', 'maintenance', 'inspection'
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Media attachments
  photo_urls TEXT[] DEFAULT '{}',
  voice_note_url TEXT,                  -- Audio description
  video_url TEXT,

  -- Location
  address TEXT NOT NULL,
  address_extra TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  neighborhood TEXT,
  city TEXT DEFAULT 'Buenos Aires',
  province TEXT DEFAULT 'CABA',
  postal_code TEXT,

  -- Timing preferences
  urgency service_urgency DEFAULT 'flexible',
  preferred_date DATE,
  preferred_time_slot TEXT,             -- 'morning', 'afternoon', 'evening', 'any'
  flexible_dates BOOLEAN DEFAULT true,
  available_dates JSONB DEFAULT '[]',   -- Array of {date, time_slots}

  -- Budget
  budget_range budget_range DEFAULT 'not_specified',
  budget_min DECIMAL(12, 2),
  budget_max DECIMAL(12, 2),
  budget_notes TEXT,

  -- Status
  status service_request_status DEFAULT 'open',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Matching
  matched_business_ids UUID[] DEFAULT '{}',  -- Businesses that received this request
  max_quotes INTEGER DEFAULT 5,

  -- Quote tracking (denormalized for performance)
  quotes_received INTEGER DEFAULT 0,
  quotes_viewed INTEGER DEFAULT 0,

  -- Accepted quote info
  accepted_quote_id UUID,
  accepted_at TIMESTAMPTZ,

  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by TEXT,                    -- 'consumer', 'system'

  -- Job linkage (after quote accepted)
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  -- Search optimization
  search_vector TSVECTOR,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BUSINESS QUOTES TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES consumer_service_requests(id) ON DELETE CASCADE,
  business_profile_id UUID NOT NULL REFERENCES business_public_profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Quote number (human-readable)
  quote_number TEXT NOT NULL UNIQUE,

  -- Pricing
  price_type TEXT DEFAULT 'fixed',      -- 'fixed', 'range', 'hourly', 'on_site'
  price_amount DECIMAL(12, 2),
  price_min DECIMAL(12, 2),
  price_max DECIMAL(12, 2),
  hourly_rate DECIMAL(12, 2),
  estimated_hours DECIMAL(4, 1),
  currency TEXT DEFAULT 'ARS',

  -- Price breakdown
  labor_cost DECIMAL(12, 2),
  materials_cost DECIMAL(12, 2),
  travel_cost DECIMAL(12, 2),
  other_costs JSONB DEFAULT '[]',       -- Array of {description, amount}

  -- Quote details
  description TEXT,
  includes TEXT[],                      -- What's included
  excludes TEXT[],                      -- What's not included
  terms TEXT,
  warranty_info TEXT,

  -- Timeline
  estimated_duration_hours DECIMAL(4, 1),
  available_date DATE,
  available_time_slot TEXT,
  can_start_immediately BOOLEAN DEFAULT false,

  -- Status
  status quote_status DEFAULT 'pending',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Consumer interaction tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,

  -- Acceptance/Rejection
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Expiry
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '48 hours',
  extended_at TIMESTAMPTZ,

  -- Withdrawal
  withdrawn_at TIMESTAMPTZ,
  withdrawal_reason TEXT,

  -- Job creation (after acceptance)
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  job_created_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- QUOTE MESSAGES (Chat between consumer and business)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS quote_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES business_quotes(id) ON DELETE CASCADE,

  -- Sender info
  sender_type TEXT NOT NULL CHECK (sender_type IN ('consumer', 'business')),
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,

  -- Message content
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',       -- Array of {type, url, name}

  -- Read tracking
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- QUOTE DECLINE TRACKING
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_quote_declines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES consumer_service_requests(id) ON DELETE CASCADE,
  business_profile_id UUID NOT NULL REFERENCES business_public_profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Decline reason
  reason TEXT NOT NULL,                 -- 'too_far', 'not_available', 'out_of_scope', 'too_busy', 'other'
  notes TEXT,

  -- Timestamps
  declined_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(service_request_id, business_profile_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- REQUEST MATCHING LOG (for algorithm tuning)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS request_matching_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES consumer_service_requests(id) ON DELETE CASCADE,

  -- Matching details
  total_businesses_considered INTEGER,
  businesses_matched INTEGER,
  matching_criteria JSONB,              -- Criteria used for matching
  ranking_scores JSONB,                 -- Scores for each matched business

  -- Performance metrics
  execution_time_ms INTEGER,

  -- Timestamps
  matched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- SAVED SEARCHES (for consumers)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS consumer_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumer_profiles(id) ON DELETE CASCADE,

  -- Search criteria
  name TEXT NOT NULL,
  category service_category,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_name TEXT,
  radius_km INTEGER DEFAULT 10,
  filters JSONB DEFAULT '{}',

  -- Alert settings
  alert_enabled BOOLEAN DEFAULT false,
  alert_frequency TEXT DEFAULT 'daily', -- 'immediately', 'daily', 'weekly'
  last_alert_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- FAVORITE BUSINESSES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS consumer_favorite_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumer_profiles(id) ON DELETE CASCADE,
  business_profile_id UUID NOT NULL REFERENCES business_public_profiles(id) ON DELETE CASCADE,

  -- Notes
  personal_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(consumer_id, business_profile_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Service requests indexes
CREATE INDEX IF NOT EXISTS idx_service_requests_consumer
  ON consumer_service_requests(consumer_id, status);

CREATE INDEX IF NOT EXISTS idx_service_requests_status
  ON consumer_service_requests(status, created_at)
  WHERE status IN ('open', 'quotes_received');

CREATE INDEX IF NOT EXISTS idx_service_requests_category
  ON consumer_service_requests(category, status, created_at);

CREATE INDEX IF NOT EXISTS idx_service_requests_location
  ON consumer_service_requests(city, neighborhood)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_service_requests_urgency
  ON consumer_service_requests(urgency, status)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_service_requests_expiry
  ON consumer_service_requests(expires_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_service_requests_search
  ON consumer_service_requests USING GIN(search_vector);

-- Quotes indexes
CREATE INDEX IF NOT EXISTS idx_business_quotes_request
  ON business_quotes(service_request_id, status);

CREATE INDEX IF NOT EXISTS idx_business_quotes_business
  ON business_quotes(business_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_business_quotes_org
  ON business_quotes(org_id, status);

CREATE INDEX IF NOT EXISTS idx_business_quotes_pending
  ON business_quotes(status, expires_at)
  WHERE status IN ('pending', 'sent', 'viewed');

CREATE INDEX IF NOT EXISTS idx_business_quotes_accepted
  ON business_quotes(accepted_at)
  WHERE status = 'accepted';

-- Quote messages indexes
CREATE INDEX IF NOT EXISTS idx_quote_messages_quote
  ON quote_messages(quote_id, created_at);

CREATE INDEX IF NOT EXISTS idx_quote_messages_unread
  ON quote_messages(quote_id, is_read)
  WHERE is_read = false;

-- Decline tracking indexes
CREATE INDEX IF NOT EXISTS idx_quote_declines_business
  ON business_quote_declines(business_profile_id, declined_at);

CREATE INDEX IF NOT EXISTS idx_quote_declines_request
  ON business_quote_declines(service_request_id);

-- Saved searches indexes
CREATE INDEX IF NOT EXISTS idx_saved_searches_consumer
  ON consumer_saved_searches(consumer_id);

CREATE INDEX IF NOT EXISTS idx_saved_searches_alert
  ON consumer_saved_searches(alert_enabled, last_alert_at)
  WHERE alert_enabled = true;

-- Favorites indexes
CREATE INDEX IF NOT EXISTS idx_favorites_consumer
  ON consumer_favorite_businesses(consumer_id);

CREATE INDEX IF NOT EXISTS idx_favorites_business
  ON consumer_favorite_businesses(business_profile_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- Update timestamp triggers
CREATE TRIGGER update_service_requests_timestamp
  BEFORE UPDATE ON consumer_service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_quotes_timestamp
  BEFORE UPDATE ON business_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_searches_timestamp
  BEFORE UPDATE ON consumer_saved_searches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate request number
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'SR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                        LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_request_number
  BEFORE INSERT ON consumer_service_requests
  FOR EACH ROW EXECUTE FUNCTION generate_request_number();

-- Generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.quote_number := 'QT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                      LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quote_number
  BEFORE INSERT ON business_quotes
  FOR EACH ROW EXECUTE FUNCTION generate_quote_number();

-- Update search vector for full-text search
CREATE OR REPLACE FUNCTION update_request_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    SETWEIGHT(TO_TSVECTOR('spanish', COALESCE(NEW.title, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('spanish', COALESCE(NEW.description, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('spanish', COALESCE(NEW.category::TEXT, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('spanish', COALESCE(NEW.neighborhood, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_request_search
  BEFORE INSERT OR UPDATE ON consumer_service_requests
  FOR EACH ROW EXECUTE FUNCTION update_request_search_vector();

-- Status change tracking
CREATE OR REPLACE FUNCTION update_request_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_request_status_change
  BEFORE UPDATE ON consumer_service_requests
  FOR EACH ROW EXECUTE FUNCTION update_request_status_changed();

CREATE OR REPLACE FUNCTION update_quote_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_quote_status_change
  BEFORE UPDATE ON business_quotes
  FOR EACH ROW EXECUTE FUNCTION update_quote_status_changed();

-- Update quote counts on service request
CREATE OR REPLACE FUNCTION update_request_quote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE consumer_service_requests
    SET quotes_received = quotes_received + 1
    WHERE id = NEW.service_request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE consumer_service_requests
    SET quotes_received = GREATEST(0, quotes_received - 1)
    WHERE id = OLD.service_request_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quote_counts
  AFTER INSERT OR DELETE ON business_quotes
  FOR EACH ROW EXECUTE FUNCTION update_request_quote_counts();

-- Auto-update status when quotes received
CREATE OR REPLACE FUNCTION auto_update_request_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quotes_received > 0 AND NEW.status = 'open' THEN
    NEW.status := 'quotes_received';
    NEW.status_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_status_update
  BEFORE UPDATE ON consumer_service_requests
  FOR EACH ROW EXECUTE FUNCTION auto_update_request_status();

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to expire old service requests
CREATE OR REPLACE FUNCTION expire_old_service_requests()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE consumer_service_requests
  SET status = 'expired', status_changed_at = NOW()
  WHERE status IN ('open', 'quotes_received')
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old quotes
CREATE OR REPLACE FUNCTION expire_old_quotes()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE business_quotes
  SET status = 'expired', status_changed_at = NOW()
  WHERE status IN ('pending', 'sent', 'viewed')
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get request stats for a consumer
CREATE OR REPLACE FUNCTION get_consumer_request_stats(p_consumer_id UUID)
RETURNS TABLE (
  total_requests INTEGER,
  open_requests INTEGER,
  completed_requests INTEGER,
  avg_quotes_per_request DECIMAL(4,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_requests,
    COUNT(*) FILTER (WHERE status IN ('open', 'quotes_received'))::INTEGER AS open_requests,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER AS completed_requests,
    ROUND(AVG(quotes_received)::DECIMAL, 2) AS avg_quotes_per_request
  FROM consumer_service_requests
  WHERE consumer_id = p_consumer_id
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to get quote stats for a business
CREATE OR REPLACE FUNCTION get_business_quote_stats(p_business_profile_id UUID)
RETURNS TABLE (
  total_quotes INTEGER,
  accepted_quotes INTEGER,
  acceptance_rate DECIMAL(5,2),
  avg_response_time_hours DECIMAL(6,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_quotes,
    COUNT(*) FILTER (WHERE status = 'accepted')::INTEGER AS accepted_quotes,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'accepted')::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2
    ) AS acceptance_rate,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (created_at -
        (SELECT created_at FROM consumer_service_requests WHERE id = service_request_id)
      )) / 3600)::DECIMAL, 2
    ) AS avg_response_time_hours
  FROM business_quotes
  WHERE business_profile_id = p_business_profile_id;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE consumer_service_requests IS 'Service requests from consumers looking for providers';
COMMENT ON TABLE business_quotes IS 'Quotes submitted by businesses for consumer service requests';
COMMENT ON TABLE quote_messages IS 'Chat messages between consumers and businesses during quote process';
COMMENT ON TABLE business_quote_declines IS 'Tracking when businesses decline service requests';
COMMENT ON TABLE request_matching_log IS 'Log of matching algorithm results for tuning';
COMMENT ON TABLE consumer_saved_searches IS 'Saved search criteria with optional alerts';
COMMENT ON TABLE consumer_favorite_businesses IS 'Consumer favorite/bookmarked businesses';

COMMENT ON COLUMN consumer_service_requests.search_vector IS 'Full-text search vector for Spanish language';
COMMENT ON COLUMN consumer_service_requests.matched_business_ids IS 'Businesses that were matched and received this request';
COMMENT ON COLUMN business_quotes.price_type IS 'Quote pricing model: fixed, range, hourly, or on_site assessment';
