-- Migration: 052_create_consumer_reviews.sql
-- Description: Create consumer reviews and rating tables for marketplace (Phase 15.8)
-- Phase: 15 - Consumer Marketplace (Free Service Finder)
-- Created: 2025-01-10

-- ══════════════════════════════════════════════════════════════════════════════
-- CONSUMER REVIEWS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS consumer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumer_profiles(id) ON DELETE CASCADE,
  business_profile_id UUID NOT NULL REFERENCES business_public_profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Optional linkage to job/quote
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES business_quotes(id) ON DELETE SET NULL,
  service_request_id UUID REFERENCES consumer_service_requests(id) ON DELETE SET NULL,

  -- Ratings (1-5 stars)
  overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  price_rating INTEGER CHECK (price_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),

  -- Review content
  title TEXT,
  review_text TEXT,
  pros TEXT,                            -- What they liked
  cons TEXT,                            -- What could be improved
  photo_urls TEXT[] DEFAULT '{}',

  -- Service details
  service_category service_category,
  service_description TEXT,             -- What service was performed
  approximate_price DECIMAL(12, 2),

  -- Verification
  verification_status review_verification DEFAULT 'unverified',
  verified_at TIMESTAMPTZ,
  verification_method TEXT,             -- 'job_linkage', 'receipt_upload', 'manual_verification'

  -- Recommendations
  would_recommend BOOLEAN DEFAULT true,
  would_use_again BOOLEAN DEFAULT true,

  -- Response from business
  business_response TEXT,
  business_response_at TIMESTAMPTZ,
  business_responder_id UUID,

  -- Moderation
  status review_status DEFAULT 'pending',
  flagged_reason TEXT,
  flagged_at TIMESTAMPTZ,
  flagged_by_type TEXT,                 -- 'business', 'system', 'consumer'
  flagged_by_id UUID,
  moderation_notes TEXT,
  moderated_by_id UUID,
  moderated_at TIMESTAMPTZ,

  -- Trust scoring
  trust_score DECIMAL(3, 2) DEFAULT 0.5, -- 0.0 to 1.0
  is_featured BOOLEAN DEFAULT false,

  -- Helpfulness tracking
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,

  -- Edit tracking
  is_edited BOOLEAN DEFAULT false,
  edit_history JSONB DEFAULT '[]',
  last_edited_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(consumer_id, job_id),
  UNIQUE(consumer_id, service_request_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- REVIEW HELPFULNESS VOTES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS review_helpfulness_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES consumer_reviews(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES consumer_profiles(id) ON DELETE CASCADE,

  -- Vote
  is_helpful BOOLEAN NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(review_id, consumer_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- REVIEW FLAGS/REPORTS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS review_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES consumer_reviews(id) ON DELETE CASCADE,

  -- Reporter info
  reporter_type TEXT NOT NULL CHECK (reporter_type IN ('consumer', 'business', 'system')),
  reporter_id UUID,

  -- Flag reason
  reason TEXT NOT NULL,                 -- 'fake', 'inappropriate', 'spam', 'wrong_business', 'personal_info', 'other'
  description TEXT,

  -- Resolution
  is_resolved BOOLEAN DEFAULT false,
  resolution TEXT,                      -- 'dismissed', 'review_removed', 'review_edited', 'warning_issued'
  resolved_by_id UUID,
  resolved_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BUSINESS RATING SUMMARIES (Materialized)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_rating_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL UNIQUE REFERENCES business_public_profiles(id) ON DELETE CASCADE,

  -- Overall stats
  total_reviews INTEGER DEFAULT 0,
  verified_reviews INTEGER DEFAULT 0,

  -- Rating averages
  overall_rating DECIMAL(2, 1) DEFAULT 0,
  punctuality_rating DECIMAL(2, 1),
  quality_rating DECIMAL(2, 1),
  price_rating DECIMAL(2, 1),
  communication_rating DECIMAL(2, 1),

  -- Rating distribution
  rating_1_count INTEGER DEFAULT 0,
  rating_2_count INTEGER DEFAULT 0,
  rating_3_count INTEGER DEFAULT 0,
  rating_4_count INTEGER DEFAULT 0,
  rating_5_count INTEGER DEFAULT 0,

  -- Trends (last 30 days vs previous 30 days)
  recent_rating_avg DECIMAL(2, 1),
  recent_rating_count INTEGER DEFAULT 0,
  rating_trend TEXT,                    -- 'up', 'down', 'stable'

  -- Recommendation stats
  recommend_percentage DECIMAL(5, 2),
  would_use_again_percentage DECIMAL(5, 2),

  -- Category breakdown
  ratings_by_category JSONB DEFAULT '{}',  -- {category: {avg: x, count: y}}

  -- Response stats
  response_rate DECIMAL(5, 2),          -- % of reviews with business response
  avg_response_time_hours DECIMAL(6, 2),

  -- Last updated
  last_calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- REVIEW ANALYTICS EVENTS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS review_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES consumer_reviews(id) ON DELETE CASCADE,
  business_profile_id UUID REFERENCES business_public_profiles(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL,             -- 'review_viewed', 'review_helpful_voted', 'review_shared', 'response_viewed'

  -- Viewer info
  viewer_type TEXT,                     -- 'consumer', 'anonymous', 'business'
  viewer_id UUID,
  viewer_session_id TEXT,

  -- Context
  source TEXT,                          -- 'profile_page', 'search_results', 'share_link'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- REVIEW MODERATION QUEUE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS review_moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL UNIQUE REFERENCES consumer_reviews(id) ON DELETE CASCADE,

  -- Queue info
  priority INTEGER DEFAULT 0,           -- Higher = more urgent
  queue_reason TEXT NOT NULL,           -- 'new_review', 'flagged', 'edited', 'low_trust_score'

  -- Fraud detection scores
  fraud_score DECIMAL(3, 2),            -- 0.0 to 1.0 (1.0 = likely fraud)
  fraud_signals JSONB DEFAULT '[]',     -- Array of detected fraud signals

  -- Assignment
  assigned_to_id UUID,
  assigned_at TIMESTAMPTZ,

  -- Status
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  decision TEXT,                        -- 'approved', 'rejected', 'needs_edit', 'escalated'
  decision_reason TEXT,

  -- Timestamps
  queued_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- FRAUD DETECTION SIGNALS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS review_fraud_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES consumer_reviews(id) ON DELETE CASCADE,

  -- Signal info
  signal_type TEXT NOT NULL,            -- 'velocity', 'text_similarity', 'ip_cluster', 'device_fingerprint', 'timing_anomaly', 'rating_pattern'
  signal_score DECIMAL(3, 2) NOT NULL,  -- 0.0 to 1.0
  signal_details JSONB,

  -- Detection metadata
  detected_by TEXT,                     -- 'automated', 'manual'

  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Consumer reviews indexes
CREATE INDEX IF NOT EXISTS idx_consumer_reviews_consumer
  ON consumer_reviews(consumer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_consumer_reviews_business
  ON consumer_reviews(business_profile_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_consumer_reviews_org
  ON consumer_reviews(org_id, status);

CREATE INDEX IF NOT EXISTS idx_consumer_reviews_job
  ON consumer_reviews(job_id)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consumer_reviews_published
  ON consumer_reviews(business_profile_id, overall_rating, created_at)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_consumer_reviews_verified
  ON consumer_reviews(business_profile_id, verification_status, overall_rating)
  WHERE status = 'published' AND verification_status = 'verified';

CREATE INDEX IF NOT EXISTS idx_consumer_reviews_pending
  ON consumer_reviews(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_consumer_reviews_featured
  ON consumer_reviews(is_featured, overall_rating)
  WHERE is_featured = true AND status = 'published';

-- Helpfulness votes indexes
CREATE INDEX IF NOT EXISTS idx_helpfulness_votes_review
  ON review_helpfulness_votes(review_id, is_helpful);

-- Review flags indexes
CREATE INDEX IF NOT EXISTS idx_review_flags_review
  ON review_flags(review_id, is_resolved);

CREATE INDEX IF NOT EXISTS idx_review_flags_unresolved
  ON review_flags(is_resolved, created_at)
  WHERE is_resolved = false;

-- Rating summaries indexes
CREATE INDEX IF NOT EXISTS idx_rating_summaries_business
  ON business_rating_summaries(business_profile_id);

CREATE INDEX IF NOT EXISTS idx_rating_summaries_ranking
  ON business_rating_summaries(overall_rating DESC, total_reviews DESC);

-- Analytics events indexes
CREATE INDEX IF NOT EXISTS idx_review_analytics_review
  ON review_analytics_events(review_id, created_at);

CREATE INDEX IF NOT EXISTS idx_review_analytics_business
  ON review_analytics_events(business_profile_id, created_at);

-- Moderation queue indexes
CREATE INDEX IF NOT EXISTS idx_moderation_queue_pending
  ON review_moderation_queue(is_processed, priority DESC, queued_at)
  WHERE is_processed = false;

CREATE INDEX IF NOT EXISTS idx_moderation_queue_assigned
  ON review_moderation_queue(assigned_to_id, is_processed)
  WHERE is_processed = false;

-- Fraud signals indexes
CREATE INDEX IF NOT EXISTS idx_fraud_signals_review
  ON review_fraud_signals(review_id);

CREATE INDEX IF NOT EXISTS idx_fraud_signals_type
  ON review_fraud_signals(signal_type, signal_score DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- Update timestamp trigger
CREATE TRIGGER update_consumer_reviews_timestamp
  BEFORE UPDATE ON consumer_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-verify reviews linked to jobs
CREATE OR REPLACE FUNCTION auto_verify_review()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_id IS NOT NULL THEN
    NEW.verification_status := 'verified';
    NEW.verified_at := NOW();
    NEW.verification_method := 'job_linkage';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verify_review_on_create
  BEFORE INSERT ON consumer_reviews
  FOR EACH ROW EXECUTE FUNCTION auto_verify_review();

-- Calculate trust score on review creation/update
CREATE OR REPLACE FUNCTION calculate_review_trust_score()
RETURNS TRIGGER AS $$
DECLARE
  trust DECIMAL(3, 2) := 0.5;
  consumer_history INTEGER;
BEGIN
  -- Verified job linkage bonus
  IF NEW.job_id IS NOT NULL THEN
    trust := trust + 0.3;
  END IF;

  -- Photos add credibility
  IF ARRAY_LENGTH(NEW.photo_urls, 1) > 0 THEN
    trust := trust + 0.1;
  END IF;

  -- Check consumer history
  SELECT total_reviews_given INTO consumer_history
  FROM consumer_profiles WHERE id = NEW.consumer_id;

  IF consumer_history > 5 THEN
    trust := trust + 0.1;
  END IF;

  NEW.trust_score := LEAST(trust, 1.0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_review_trust_score
  BEFORE INSERT OR UPDATE ON consumer_reviews
  FOR EACH ROW EXECUTE FUNCTION calculate_review_trust_score();

-- Update helpfulness counts
CREATE OR REPLACE FUNCTION update_helpfulness_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_helpful THEN
      UPDATE consumer_reviews
      SET helpful_count = helpful_count + 1
      WHERE id = NEW.review_id;
    ELSE
      UPDATE consumer_reviews
      SET not_helpful_count = not_helpful_count + 1
      WHERE id = NEW.review_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_helpful THEN
      UPDATE consumer_reviews
      SET helpful_count = GREATEST(0, helpful_count - 1)
      WHERE id = OLD.review_id;
    ELSE
      UPDATE consumer_reviews
      SET not_helpful_count = GREATEST(0, not_helpful_count - 1)
      WHERE id = OLD.review_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_helpful != NEW.is_helpful THEN
    IF NEW.is_helpful THEN
      UPDATE consumer_reviews
      SET helpful_count = helpful_count + 1,
          not_helpful_count = GREATEST(0, not_helpful_count - 1)
      WHERE id = NEW.review_id;
    ELSE
      UPDATE consumer_reviews
      SET helpful_count = GREATEST(0, helpful_count - 1),
          not_helpful_count = not_helpful_count + 1
      WHERE id = NEW.review_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_helpfulness_votes
  AFTER INSERT OR UPDATE OR DELETE ON review_helpfulness_votes
  FOR EACH ROW EXECUTE FUNCTION update_helpfulness_counts();

-- Auto-queue new reviews for moderation
CREATE OR REPLACE FUNCTION queue_review_for_moderation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO review_moderation_queue (review_id, priority, queue_reason)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.overall_rating <= 2 THEN 2  -- Low ratings get higher priority
      WHEN NEW.trust_score < 0.5 THEN 1
      ELSE 0
    END,
    'new_review'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_queue_review
  AFTER INSERT ON consumer_reviews
  FOR EACH ROW EXECUTE FUNCTION queue_review_for_moderation();

-- Track edit history
CREATE OR REPLACE FUNCTION track_review_edits()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.review_text IS DISTINCT FROM NEW.review_text OR
     OLD.overall_rating IS DISTINCT FROM NEW.overall_rating THEN
    NEW.is_edited := true;
    NEW.last_edited_at := NOW();
    NEW.edit_history := NEW.edit_history || jsonb_build_object(
      'edited_at', NOW(),
      'old_rating', OLD.overall_rating,
      'new_rating', NEW.overall_rating,
      'old_text', LEFT(OLD.review_text, 200)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_review_edit_history
  BEFORE UPDATE ON consumer_reviews
  FOR EACH ROW EXECUTE FUNCTION track_review_edits();

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to recalculate rating summary for a business
CREATE OR REPLACE FUNCTION recalculate_business_ratings(p_business_profile_id UUID)
RETURNS void AS $$
DECLARE
  recent_start DATE := CURRENT_DATE - INTERVAL '30 days';
  prev_start DATE := CURRENT_DATE - INTERVAL '60 days';
BEGIN
  INSERT INTO business_rating_summaries (
    business_profile_id,
    total_reviews,
    verified_reviews,
    overall_rating,
    punctuality_rating,
    quality_rating,
    price_rating,
    communication_rating,
    rating_1_count,
    rating_2_count,
    rating_3_count,
    rating_4_count,
    rating_5_count,
    recent_rating_avg,
    recent_rating_count,
    rating_trend,
    recommend_percentage,
    would_use_again_percentage,
    response_rate,
    last_calculated_at
  )
  SELECT
    p_business_profile_id,
    COUNT(*),
    COUNT(*) FILTER (WHERE verification_status = 'verified'),
    ROUND(AVG(overall_rating)::DECIMAL, 1),
    ROUND(AVG(punctuality_rating)::DECIMAL, 1),
    ROUND(AVG(quality_rating)::DECIMAL, 1),
    ROUND(AVG(price_rating)::DECIMAL, 1),
    ROUND(AVG(communication_rating)::DECIMAL, 1),
    COUNT(*) FILTER (WHERE overall_rating = 1),
    COUNT(*) FILTER (WHERE overall_rating = 2),
    COUNT(*) FILTER (WHERE overall_rating = 3),
    COUNT(*) FILTER (WHERE overall_rating = 4),
    COUNT(*) FILTER (WHERE overall_rating = 5),
    ROUND(AVG(overall_rating) FILTER (WHERE created_at >= recent_start)::DECIMAL, 1),
    COUNT(*) FILTER (WHERE created_at >= recent_start),
    CASE
      WHEN AVG(overall_rating) FILTER (WHERE created_at >= recent_start) >
           AVG(overall_rating) FILTER (WHERE created_at >= prev_start AND created_at < recent_start) + 0.2
        THEN 'up'
      WHEN AVG(overall_rating) FILTER (WHERE created_at >= recent_start) <
           AVG(overall_rating) FILTER (WHERE created_at >= prev_start AND created_at < recent_start) - 0.2
        THEN 'down'
      ELSE 'stable'
    END,
    ROUND((COUNT(*) FILTER (WHERE would_recommend = true)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
    ROUND((COUNT(*) FILTER (WHERE would_use_again = true)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
    ROUND((COUNT(*) FILTER (WHERE business_response IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
    NOW()
  FROM consumer_reviews
  WHERE business_profile_id = p_business_profile_id
    AND status = 'published'
  ON CONFLICT (business_profile_id) DO UPDATE SET
    total_reviews = EXCLUDED.total_reviews,
    verified_reviews = EXCLUDED.verified_reviews,
    overall_rating = EXCLUDED.overall_rating,
    punctuality_rating = EXCLUDED.punctuality_rating,
    quality_rating = EXCLUDED.quality_rating,
    price_rating = EXCLUDED.price_rating,
    communication_rating = EXCLUDED.communication_rating,
    rating_1_count = EXCLUDED.rating_1_count,
    rating_2_count = EXCLUDED.rating_2_count,
    rating_3_count = EXCLUDED.rating_3_count,
    rating_4_count = EXCLUDED.rating_4_count,
    rating_5_count = EXCLUDED.rating_5_count,
    recent_rating_avg = EXCLUDED.recent_rating_avg,
    recent_rating_count = EXCLUDED.recent_rating_count,
    rating_trend = EXCLUDED.rating_trend,
    recommend_percentage = EXCLUDED.recommend_percentage,
    would_use_again_percentage = EXCLUDED.would_use_again_percentage,
    response_rate = EXCLUDED.response_rate,
    last_calculated_at = NOW();

  -- Also update the denormalized ratings on business_public_profiles
  UPDATE business_public_profiles
  SET
    overall_rating = (SELECT overall_rating FROM business_rating_summaries WHERE business_profile_id = p_business_profile_id),
    rating_count = (SELECT total_reviews FROM business_rating_summaries WHERE business_profile_id = p_business_profile_id),
    punctuality_rating = (SELECT punctuality_rating FROM business_rating_summaries WHERE business_profile_id = p_business_profile_id),
    quality_rating = (SELECT quality_rating FROM business_rating_summaries WHERE business_profile_id = p_business_profile_id),
    price_rating = (SELECT price_rating FROM business_rating_summaries WHERE business_profile_id = p_business_profile_id),
    communication_rating = (SELECT communication_rating FROM business_rating_summaries WHERE business_profile_id = p_business_profile_id),
    updated_at = NOW()
  WHERE id = p_business_profile_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check for potential fraud signals
CREATE OR REPLACE FUNCTION detect_review_fraud_signals(p_review_id UUID)
RETURNS TABLE (
  signal_type TEXT,
  signal_score DECIMAL(3, 2),
  signal_details JSONB
) AS $$
DECLARE
  review_record RECORD;
  consumer_record RECORD;
  velocity_count INTEGER;
  similar_text_count INTEGER;
BEGIN
  SELECT * INTO review_record FROM consumer_reviews WHERE id = p_review_id;
  SELECT * INTO consumer_record FROM consumer_profiles WHERE id = review_record.consumer_id;

  -- 1. Velocity check: Too many reviews from same consumer in short time
  SELECT COUNT(*) INTO velocity_count
  FROM consumer_reviews
  WHERE consumer_id = review_record.consumer_id
    AND created_at > NOW() - INTERVAL '24 hours'
    AND id != p_review_id;

  IF velocity_count >= 3 THEN
    RETURN QUERY SELECT
      'velocity'::TEXT,
      LEAST(velocity_count * 0.2, 1.0)::DECIMAL(3, 2),
      jsonb_build_object('reviews_in_24h', velocity_count + 1);
  END IF;

  -- 2. New account leaving many reviews
  IF consumer_record.created_at > NOW() - INTERVAL '7 days' AND
     consumer_record.total_reviews_given > 3 THEN
    RETURN QUERY SELECT
      'new_account_high_volume'::TEXT,
      0.7::DECIMAL(3, 2),
      jsonb_build_object(
        'account_age_days', EXTRACT(DAY FROM NOW() - consumer_record.created_at),
        'review_count', consumer_record.total_reviews_given
      );
  END IF;

  -- 3. Extreme rating pattern (all 5s or all 1s)
  IF review_record.overall_rating = 5 AND
     review_record.punctuality_rating = 5 AND
     review_record.quality_rating = 5 AND
     review_record.price_rating = 5 AND
     review_record.communication_rating = 5 THEN
    RETURN QUERY SELECT
      'all_perfect_scores'::TEXT,
      0.3::DECIMAL(3, 2),
      jsonb_build_object('pattern', 'all_5_stars');
  END IF;

  IF review_record.overall_rating = 1 AND
     review_record.punctuality_rating = 1 AND
     review_record.quality_rating = 1 AND
     review_record.price_rating = 1 AND
     review_record.communication_rating = 1 THEN
    RETURN QUERY SELECT
      'all_minimum_scores'::TEXT,
      0.4::DECIMAL(3, 2),
      jsonb_build_object('pattern', 'all_1_stars');
  END IF;

  -- 4. Very short review text
  IF review_record.review_text IS NOT NULL AND LENGTH(review_record.review_text) < 20 THEN
    RETURN QUERY SELECT
      'short_review'::TEXT,
      0.2::DECIMAL(3, 2),
      jsonb_build_object('text_length', LENGTH(review_record.review_text));
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to get top reviews for a business
CREATE OR REPLACE FUNCTION get_top_reviews(
  p_business_profile_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  consumer_first_name TEXT,
  overall_rating INTEGER,
  review_text TEXT,
  photo_urls TEXT[],
  verification_status review_verification,
  helpful_count INTEGER,
  created_at TIMESTAMPTZ,
  business_response TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id,
    cp.first_name,
    cr.overall_rating,
    cr.review_text,
    cr.photo_urls,
    cr.verification_status,
    cr.helpful_count,
    cr.created_at,
    cr.business_response
  FROM consumer_reviews cr
  JOIN consumer_profiles cp ON cp.id = cr.consumer_id
  WHERE cr.business_profile_id = p_business_profile_id
    AND cr.status = 'published'
  ORDER BY
    (cr.is_featured DESC),
    (cr.verification_status = 'verified' DESC),
    cr.helpful_count DESC,
    cr.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE consumer_reviews IS 'Consumer reviews of businesses after service completion';
COMMENT ON TABLE review_helpfulness_votes IS 'Votes indicating whether a review was helpful';
COMMENT ON TABLE review_flags IS 'Reports/flags against reviews for moderation';
COMMENT ON TABLE business_rating_summaries IS 'Materialized rating aggregates for businesses';
COMMENT ON TABLE review_analytics_events IS 'Analytics events for review interactions';
COMMENT ON TABLE review_moderation_queue IS 'Queue for review moderation workflow';
COMMENT ON TABLE review_fraud_signals IS 'Detected fraud signals for reviews';

COMMENT ON COLUMN consumer_reviews.trust_score IS 'Automated trust score 0.0-1.0 based on verification and consumer history';
COMMENT ON COLUMN consumer_reviews.verification_status IS 'Whether the review is verified through job linkage or other methods';
COMMENT ON COLUMN review_moderation_queue.fraud_score IS 'Automated fraud detection score 0.0-1.0';
