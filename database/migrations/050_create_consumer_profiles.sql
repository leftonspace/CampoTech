-- Migration: 050_create_consumer_profiles.sql
-- Description: Create consumer profiles table for marketplace (Phase 15.1)
-- Phase: 15 - Consumer Marketplace (Free Service Finder)
-- Created: 2025-01-10

-- ══════════════════════════════════════════════════════════════════════════════
-- ENUMS FOR CONSUMER MARKETPLACE
-- ══════════════════════════════════════════════════════════════════════════════

-- Consumer preferred contact method
CREATE TYPE consumer_contact_preference AS ENUM (
  'whatsapp',
  'phone',
  'app',
  'email'
);

-- Service urgency levels
CREATE TYPE service_urgency AS ENUM (
  'emergency',
  'today',
  'this_week',
  'flexible'
);

-- Service request status
CREATE TYPE service_request_status AS ENUM (
  'open',
  'quotes_received',
  'accepted',
  'in_progress',
  'completed',
  'cancelled',
  'expired'
);

-- Quote status
CREATE TYPE quote_status AS ENUM (
  'pending',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
  'withdrawn'
);

-- Review status
CREATE TYPE review_status AS ENUM (
  'pending',
  'published',
  'flagged',
  'removed'
);

-- Review verification status
CREATE TYPE review_verification AS ENUM (
  'verified',
  'unverified',
  'pending'
);

-- Business badge types
CREATE TYPE business_badge AS ENUM (
  'verified',
  'top_rated',
  'fast_responder',
  'new',
  'licensed',
  'insured',
  'background_checked',
  'premium'
);

-- Service category enum (extends job_type but more comprehensive)
CREATE TYPE service_category AS ENUM (
  'plumbing',
  'electrical',
  'hvac',
  'gas',
  'locksmith',
  'painting',
  'construction',
  'cleaning',
  'gardening',
  'pest_control',
  'appliance_repair',
  'carpentry',
  'roofing',
  'flooring',
  'windows_doors',
  'security',
  'moving',
  'general'
);

-- Budget range enum
CREATE TYPE budget_range AS ENUM (
  'under_5000',
  '5000_15000',
  '15000_50000',
  '50000_100000',
  'over_100000',
  'not_specified'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- CONSUMER PROFILES TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS consumer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authentication (phone-only, no email required)
  phone TEXT NOT NULL UNIQUE,
  phone_verified BOOLEAN DEFAULT false,
  email TEXT,
  email_verified BOOLEAN DEFAULT false,

  -- Profile information
  first_name TEXT NOT NULL,
  last_name TEXT,
  profile_photo_url TEXT,
  bio TEXT,

  -- Default location (for service matching)
  default_address TEXT,
  default_address_extra TEXT,
  default_lat DECIMAL(10, 8),
  default_lng DECIMAL(11, 8),
  neighborhood TEXT,                    -- "Palermo", "Belgrano"
  city TEXT DEFAULT 'Buenos Aires',
  province TEXT DEFAULT 'CABA',
  postal_code TEXT,

  -- Saved addresses (JSON array for multiple locations)
  saved_addresses JSONB DEFAULT '[]',

  -- Preferences
  preferred_contact consumer_contact_preference DEFAULT 'whatsapp',
  language TEXT DEFAULT 'es-AR',
  push_notifications_enabled BOOLEAN DEFAULT true,
  email_notifications_enabled BOOLEAN DEFAULT false,
  sms_notifications_enabled BOOLEAN DEFAULT true,

  -- Privacy settings
  profile_visibility TEXT DEFAULT 'service_providers',  -- 'public', 'service_providers', 'private'
  show_last_name BOOLEAN DEFAULT false,

  -- Stats (denormalized for performance)
  total_requests INTEGER DEFAULT 0,
  total_jobs_completed INTEGER DEFAULT 0,
  total_reviews_given INTEGER DEFAULT 0,
  average_rating_given DECIMAL(2,1),

  -- Referral tracking
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES consumer_profiles(id),
  referral_count INTEGER DEFAULT 0,

  -- Account status
  is_active BOOLEAN DEFAULT true,
  is_suspended BOOLEAN DEFAULT false,
  suspension_reason TEXT,

  -- FCM/Push notification tokens
  fcm_tokens JSONB DEFAULT '[]',

  -- Last known location (for nearby services)
  last_known_lat DECIMAL(10, 8),
  last_known_lng DECIMAL(11, 8),
  last_location_update TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ══════════════════════════════════════════════════════════════════════════════
-- CONSUMER SESSIONS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS consumer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumer_profiles(id) ON DELETE CASCADE,

  -- Token data
  refresh_token_hash TEXT NOT NULL,

  -- Device info
  device_type TEXT,                     -- 'ios', 'android', 'web'
  device_id TEXT,
  device_name TEXT,
  app_version TEXT,

  -- Location at login
  ip_address TEXT,

  -- Session state
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- CONSUMER OTP TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS consumer_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,

  -- OTP state
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  is_used BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BUSINESS PUBLIC PROFILE (extends organizations)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_public_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Public profile info
  display_name TEXT NOT NULL,
  slug TEXT UNIQUE,                     -- URL-friendly name: "servifrio-palermo"
  logo_url TEXT,
  cover_photo_url TEXT,
  description TEXT,
  short_description TEXT,               -- Max 150 chars for cards

  -- Gallery
  gallery_photos JSONB DEFAULT '[]',    -- Array of {url, caption, order}
  work_showcase JSONB DEFAULT '[]',     -- Array of {before_url, after_url, description, category}

  -- Services offered
  categories service_category[] DEFAULT '{}',
  services JSONB DEFAULT '[]',          -- Array of {name, description, priceRange, duration}

  -- Service areas
  service_areas JSONB DEFAULT '[]',     -- Array of {neighborhood, city, radius_km}
  max_travel_distance_km INTEGER DEFAULT 20,

  -- Contact preferences (for marketplace)
  accepts_quotes BOOLEAN DEFAULT true,
  auto_respond_quotes BOOLEAN DEFAULT false,
  response_template TEXT,

  -- Working hours
  working_hours JSONB DEFAULT '{}',     -- {monday: {start: "09:00", end: "18:00"}, ...}
  accepts_emergency BOOLEAN DEFAULT false,
  emergency_surcharge_percentage INTEGER,

  -- Availability
  accepting_new_clients BOOLEAN DEFAULT true,
  max_active_quotes INTEGER DEFAULT 10,
  quote_response_time_hours INTEGER DEFAULT 24,

  -- Trust signals & verification
  cuit_verified BOOLEAN DEFAULT false,
  license_verified BOOLEAN DEFAULT false,
  license_number TEXT,
  license_expiry DATE,
  insurance_verified BOOLEAN DEFAULT false,
  insurance_provider TEXT,
  insurance_expiry DATE,
  background_check_verified BOOLEAN DEFAULT false,
  background_check_date DATE,

  -- Badges (denormalized for quick access)
  badges business_badge[] DEFAULT '{}',

  -- Rating summary (denormalized)
  overall_rating DECIMAL(2,1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  punctuality_rating DECIMAL(2,1),
  quality_rating DECIMAL(2,1),
  price_rating DECIMAL(2,1),
  communication_rating DECIMAL(2,1),

  -- Stats (denormalized)
  total_jobs_completed INTEGER DEFAULT 0,
  total_quotes_sent INTEGER DEFAULT 0,
  quote_acceptance_rate DECIMAL(3,2),
  avg_response_time_hours DECIMAL(4,1),
  years_on_platform DECIMAL(3,1) DEFAULT 0,

  -- Profile completeness (0-100)
  profile_completeness INTEGER DEFAULT 0,

  -- Visibility & status
  is_visible BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_suspended BOOLEAN DEFAULT false,
  suspension_reason TEXT,

  -- SEO
  meta_title TEXT,
  meta_description TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- PROFILE VIEW TRACKING
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id UUID NOT NULL REFERENCES business_public_profiles(id) ON DELETE CASCADE,
  consumer_id UUID REFERENCES consumer_profiles(id) ON DELETE SET NULL,

  -- View context
  source TEXT,                          -- 'search', 'category', 'direct', 'referral'
  search_query TEXT,
  category service_category,

  -- Device info
  device_type TEXT,

  -- Location at view time
  view_lat DECIMAL(10, 8),
  view_lng DECIMAL(11, 8),

  -- Session tracking
  session_id TEXT,

  -- Timestamps
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Consumer profiles indexes
CREATE INDEX IF NOT EXISTS idx_consumer_profiles_phone
  ON consumer_profiles(phone);

CREATE INDEX IF NOT EXISTS idx_consumer_profiles_email
  ON consumer_profiles(email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consumer_profiles_location
  ON consumer_profiles(city, neighborhood);

CREATE INDEX IF NOT EXISTS idx_consumer_profiles_active
  ON consumer_profiles(is_active, last_active_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_consumer_profiles_referral
  ON consumer_profiles(referral_code)
  WHERE referral_code IS NOT NULL;

-- Consumer sessions indexes
CREATE INDEX IF NOT EXISTS idx_consumer_sessions_consumer
  ON consumer_sessions(consumer_id, is_active);

CREATE INDEX IF NOT EXISTS idx_consumer_sessions_token
  ON consumer_sessions(refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_consumer_sessions_expiry
  ON consumer_sessions(expires_at)
  WHERE is_active = true;

-- Consumer OTP indexes
CREATE INDEX IF NOT EXISTS idx_consumer_otp_phone
  ON consumer_otp_codes(phone, expires_at);

CREATE INDEX IF NOT EXISTS idx_consumer_otp_cleanup
  ON consumer_otp_codes(expires_at)
  WHERE is_used = false;

-- Business public profiles indexes
CREATE INDEX IF NOT EXISTS idx_business_public_profiles_org
  ON business_public_profiles(org_id);

CREATE INDEX IF NOT EXISTS idx_business_public_profiles_slug
  ON business_public_profiles(slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_public_profiles_visible
  ON business_public_profiles(is_visible, overall_rating DESC)
  WHERE is_visible = true AND is_suspended = false;

CREATE INDEX IF NOT EXISTS idx_business_public_profiles_categories
  ON business_public_profiles USING GIN(categories);

CREATE INDEX IF NOT EXISTS idx_business_public_profiles_rating
  ON business_public_profiles(overall_rating DESC, rating_count DESC)
  WHERE is_visible = true;

-- Profile views indexes
CREATE INDEX IF NOT EXISTS idx_business_profile_views_business
  ON business_profile_views(business_profile_id, viewed_at);

CREATE INDEX IF NOT EXISTS idx_business_profile_views_consumer
  ON business_profile_views(consumer_id, viewed_at)
  WHERE consumer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_profile_views_date
  ON business_profile_views(viewed_at);

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- Update timestamp trigger for consumer_profiles
CREATE TRIGGER update_consumer_profiles_timestamp
  BEFORE UPDATE ON consumer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update timestamp trigger for business_public_profiles
CREATE TRIGGER update_business_public_profiles_timestamp
  BEFORE UPDATE ON business_public_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate referral code on consumer creation
CREATE OR REPLACE FUNCTION generate_consumer_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_consumer_referral_code
  BEFORE INSERT ON consumer_profiles
  FOR EACH ROW EXECUTE FUNCTION generate_consumer_referral_code();

-- Generate slug for business public profile
CREATE OR REPLACE FUNCTION generate_business_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  IF NEW.slug IS NULL AND NEW.display_name IS NOT NULL THEN
    -- Convert display name to URL-friendly slug
    base_slug := LOWER(TRIM(NEW.display_name));
    base_slug := REGEXP_REPLACE(base_slug, '[áàäâã]', 'a', 'g');
    base_slug := REGEXP_REPLACE(base_slug, '[éèëê]', 'e', 'g');
    base_slug := REGEXP_REPLACE(base_slug, '[íìïî]', 'i', 'g');
    base_slug := REGEXP_REPLACE(base_slug, '[óòöôõ]', 'o', 'g');
    base_slug := REGEXP_REPLACE(base_slug, '[úùüû]', 'u', 'g');
    base_slug := REGEXP_REPLACE(base_slug, '[ñ]', 'n', 'g');
    base_slug := REGEXP_REPLACE(base_slug, '[^a-z0-9\s-]', '', 'g');
    base_slug := REGEXP_REPLACE(base_slug, '\s+', '-', 'g');
    base_slug := REGEXP_REPLACE(base_slug, '-+', '-', 'g');
    base_slug := TRIM(BOTH '-' FROM base_slug);

    final_slug := base_slug;

    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM business_public_profiles WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;

    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_business_slug
  BEFORE INSERT OR UPDATE ON business_public_profiles
  FOR EACH ROW EXECUTE FUNCTION generate_business_slug();

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to calculate profile completeness
CREATE OR REPLACE FUNCTION calculate_profile_completeness(profile_id UUID)
RETURNS INTEGER AS $$
DECLARE
  completeness INTEGER := 0;
  profile RECORD;
BEGIN
  SELECT * INTO profile FROM business_public_profiles WHERE id = profile_id;

  IF profile IS NULL THEN
    RETURN 0;
  END IF;

  -- Base info (30 points)
  IF profile.display_name IS NOT NULL THEN completeness := completeness + 10; END IF;
  IF profile.description IS NOT NULL AND LENGTH(profile.description) > 50 THEN completeness := completeness + 10; END IF;
  IF profile.short_description IS NOT NULL THEN completeness := completeness + 10; END IF;

  -- Visual (20 points)
  IF profile.logo_url IS NOT NULL THEN completeness := completeness + 10; END IF;
  IF profile.cover_photo_url IS NOT NULL THEN completeness := completeness + 5; END IF;
  IF JSONB_ARRAY_LENGTH(profile.gallery_photos) >= 3 THEN completeness := completeness + 5; END IF;

  -- Services (20 points)
  IF ARRAY_LENGTH(profile.categories, 1) > 0 THEN completeness := completeness + 10; END IF;
  IF JSONB_ARRAY_LENGTH(profile.services) >= 3 THEN completeness := completeness + 10; END IF;

  -- Location & availability (15 points)
  IF JSONB_ARRAY_LENGTH(profile.service_areas) > 0 THEN completeness := completeness + 5; END IF;
  IF profile.working_hours != '{}'::JSONB THEN completeness := completeness + 5; END IF;
  IF profile.accepting_new_clients THEN completeness := completeness + 5; END IF;

  -- Trust signals (15 points)
  IF profile.cuit_verified THEN completeness := completeness + 5; END IF;
  IF profile.license_verified THEN completeness := completeness + 5; END IF;
  IF profile.insurance_verified THEN completeness := completeness + 5; END IF;

  RETURN completeness;
END;
$$ LANGUAGE plpgsql;

-- Function to update badges based on metrics
CREATE OR REPLACE FUNCTION update_business_badges(profile_id UUID)
RETURNS business_badge[] AS $$
DECLARE
  profile RECORD;
  new_badges business_badge[] := '{}';
BEGIN
  SELECT * INTO profile FROM business_public_profiles WHERE id = profile_id;

  IF profile IS NULL THEN
    RETURN new_badges;
  END IF;

  -- Verified badge
  IF profile.cuit_verified THEN
    new_badges := array_append(new_badges, 'verified'::business_badge);
  END IF;

  -- Top rated badge (4.5+ with 10+ reviews)
  IF profile.overall_rating >= 4.5 AND profile.rating_count >= 10 THEN
    new_badges := array_append(new_badges, 'top_rated'::business_badge);
  END IF;

  -- Fast responder badge (avg response < 2 hours)
  IF profile.avg_response_time_hours IS NOT NULL AND profile.avg_response_time_hours <= 2 THEN
    new_badges := array_append(new_badges, 'fast_responder'::business_badge);
  END IF;

  -- New badge (created in last 30 days)
  IF profile.created_at > NOW() - INTERVAL '30 days' THEN
    new_badges := array_append(new_badges, 'new'::business_badge);
  END IF;

  -- Licensed badge
  IF profile.license_verified THEN
    new_badges := array_append(new_badges, 'licensed'::business_badge);
  END IF;

  -- Insured badge
  IF profile.insurance_verified THEN
    new_badges := array_append(new_badges, 'insured'::business_badge);
  END IF;

  -- Background checked badge
  IF profile.background_check_verified THEN
    new_badges := array_append(new_badges, 'background_checked'::business_badge);
  END IF;

  RETURN new_badges;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_consumer_otps()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM consumer_otp_codes
  WHERE expires_at < NOW() OR is_used = true;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_consumer_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE consumer_sessions
  SET is_active = false
  WHERE expires_at < NOW() AND is_active = true;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE consumer_profiles IS 'Consumer profiles for marketplace - regular people looking for services (FREE tier)';
COMMENT ON TABLE consumer_sessions IS 'Authentication sessions for consumer accounts';
COMMENT ON TABLE consumer_otp_codes IS 'One-time passwords for consumer phone verification';
COMMENT ON TABLE business_public_profiles IS 'Public-facing business profiles visible to consumers in marketplace';
COMMENT ON TABLE business_profile_views IS 'Analytics tracking for business profile views';

COMMENT ON COLUMN consumer_profiles.phone IS 'Primary authentication method - Argentine phone format';
COMMENT ON COLUMN consumer_profiles.preferred_contact IS 'How consumer prefers to be contacted by businesses';
COMMENT ON COLUMN consumer_profiles.referral_code IS 'Unique code for consumer to refer friends';
COMMENT ON COLUMN business_public_profiles.slug IS 'URL-friendly identifier for SEO pages';
COMMENT ON COLUMN business_public_profiles.badges IS 'Trust badges earned by business';
COMMENT ON COLUMN business_public_profiles.profile_completeness IS 'Percentage score 0-100';
