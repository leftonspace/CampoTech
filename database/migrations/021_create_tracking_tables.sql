-- Migration: 021_create_tracking_tables.sql
-- Description: Create tables for real-time job tracking system
-- Phase: 13.4 - Real-Time Job Tracking

-- ══════════════════════════════════════════════════════════════════════════════
-- TECHNICIAN LOCATIONS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS technician_locations (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(6, 2),
  heading DECIMAL(5, 2),
  speed DECIMAL(6, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding recent locations
CREATE INDEX IF NOT EXISTS idx_technician_locations_updated
  ON technician_locations(updated_at DESC);

COMMENT ON TABLE technician_locations IS 'Current/last known technician locations for tracking';
COMMENT ON COLUMN technician_locations.accuracy IS 'GPS accuracy in meters';
COMMENT ON COLUMN technician_locations.heading IS 'Direction of travel in degrees (0-360)';
COMMENT ON COLUMN technician_locations.speed IS 'Speed in km/h';

-- ══════════════════════════════════════════════════════════════════════════════
-- TECHNICIAN LOCATION HISTORY (for analytics)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS technician_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(6, 2),
  heading DECIMAL(5, 2),
  speed DECIMAL(6, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for better performance (in production)
-- CREATE INDEX IF NOT EXISTS idx_tech_location_history_user_date
--   ON technician_location_history(user_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_tech_location_history_job
  ON technician_location_history(job_id, recorded_at);

COMMENT ON TABLE technician_location_history IS 'Historical location data for route analysis';

-- ══════════════════════════════════════════════════════════════════════════════
-- JOB STATUS HISTORY (enhanced)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  previous_status VARCHAR(50),
  changed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by_type VARCHAR(20) DEFAULT 'staff' CHECK (changed_by_type IN ('staff', 'system', 'customer')),
  notes TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_status_history_job
  ON job_status_history(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_status_history_changed_by
  ON job_status_history(changed_by_id, created_at DESC);

COMMENT ON TABLE job_status_history IS 'Complete audit trail of job status changes';

-- ══════════════════════════════════════════════════════════════════════════════
-- ETA CACHE (optional optimization)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS eta_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_lat DECIMAL(10, 8) NOT NULL,
  origin_lng DECIMAL(11, 8) NOT NULL,
  dest_lat DECIMAL(10, 8) NOT NULL,
  dest_lng DECIMAL(11, 8) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  distance_meters INTEGER NOT NULL,
  source VARCHAR(20) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Composite index for cache lookups (rounded coordinates)
CREATE INDEX IF NOT EXISTS idx_eta_cache_coords
  ON eta_cache(
    ROUND(origin_lat::numeric, 4),
    ROUND(origin_lng::numeric, 4),
    ROUND(dest_lat::numeric, 4),
    ROUND(dest_lng::numeric, 4)
  )
  WHERE expires_at > NOW();

COMMENT ON TABLE eta_cache IS 'Cached ETA calculations to reduce API calls';

-- ══════════════════════════════════════════════════════════════════════════════
-- TRACKING NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tracking_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  sent_via TEXT[] DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_notifications_customer
  ON tracking_notifications(customer_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tracking_notifications_job
  ON tracking_notifications(job_id, created_at DESC);

COMMENT ON TABLE tracking_notifications IS 'Tracking-related notifications sent to customers';

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to record location history (call periodically, not on every update)
CREATE OR REPLACE FUNCTION record_technician_location_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only record if moved significantly (>50m) or every 5 minutes
  IF NOT EXISTS (
    SELECT 1 FROM technician_location_history
    WHERE user_id = NEW.user_id
      AND recorded_at > NOW() - INTERVAL '5 minutes'
      AND ST_Distance(
        ST_MakePoint(latitude, longitude)::geography,
        ST_MakePoint(NEW.latitude, NEW.longitude)::geography
      ) < 50
  ) THEN
    INSERT INTO technician_location_history (
      user_id, latitude, longitude, accuracy, heading, speed
    ) VALUES (
      NEW.user_id, NEW.latitude, NEW.longitude, NEW.accuracy, NEW.heading, NEW.speed
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Trigger commented out as it requires PostGIS
-- CREATE TRIGGER trg_record_location_history
--   AFTER INSERT OR UPDATE ON technician_locations
--   FOR EACH ROW EXECUTE FUNCTION record_technician_location_history();

-- Function to cleanup old location history
CREATE OR REPLACE FUNCTION cleanup_old_location_history()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM technician_location_history
  WHERE recorded_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired ETA cache
CREATE OR REPLACE FUNCTION cleanup_expired_eta_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM eta_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_location_history() IS 'Remove location history older than 30 days';
COMMENT ON FUNCTION cleanup_expired_eta_cache() IS 'Remove expired ETA cache entries';

-- ══════════════════════════════════════════════════════════════════════════════
-- ADD TRACKING COLUMNS TO JOBS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

-- Add latitude/longitude to jobs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE jobs ADD COLUMN latitude DECIMAL(10, 8);
    ALTER TABLE jobs ADD COLUMN longitude DECIMAL(11, 8);
    COMMENT ON COLUMN jobs.latitude IS 'Service location latitude';
    COMMENT ON COLUMN jobs.longitude IS 'Service location longitude';
  END IF;
END $$;

-- Add en_route status to job_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'job_status' AND e.enumlabel = 'en_route'
  ) THEN
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'en_route' AFTER 'confirmed';
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'arrived' AFTER 'en_route';
  END IF;
EXCEPTION
  WHEN others THEN
    -- Type might not exist or values might already be there
    NULL;
END $$;
