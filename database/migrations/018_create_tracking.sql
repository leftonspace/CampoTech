-- Migration 018: Create tracking tables
-- Phase 9.9: Customer Live Tracking System

-- Active tracking sessions
CREATE TABLE tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) UNIQUE,
    technician_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Current position (updated every 30 seconds)
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    current_speed DECIMAL(5, 2),
    current_heading DECIMAL(5, 2),
    movement_mode TEXT DEFAULT 'driving',

    -- ETA information
    eta_minutes INTEGER,
    eta_updated_at TIMESTAMPTZ,
    route_polyline TEXT,
    traffic_aware BOOLEAN DEFAULT false,

    -- Destination
    destination_lat DECIMAL(10, 8),
    destination_lng DECIMAL(11, 8),
    destination_address TEXT,

    -- Session state
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Position update counter
    position_update_count INTEGER DEFAULT 0,
    last_position_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Location history for the session
CREATE TABLE tracking_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES tracking_sessions(id) ON DELETE CASCADE,

    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2),
    heading DECIMAL(5, 2),
    accuracy DECIMAL(5, 2),
    movement_mode TEXT,

    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Short-lived tracking tokens for customers
CREATE TABLE tracking_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id),
    session_id UUID REFERENCES tracking_sessions(id),

    -- Security
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,

    -- Optional: limit by IP for security
    allowed_ip TEXT
);

-- Tracking usage for billing/tier enforcement
CREATE TABLE tracking_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Usage counters
    sessions_count INTEGER DEFAULT 0,
    map_loads_count INTEGER DEFAULT 0,
    directions_requests_count INTEGER DEFAULT 0,

    -- Cost tracking
    estimated_cost_usd DECIMAL(10, 2) DEFAULT 0,

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, period_start)
);

-- Indexes
CREATE INDEX idx_tracking_sessions_job ON tracking_sessions(job_id);
CREATE INDEX idx_tracking_sessions_technician ON tracking_sessions(technician_id);
CREATE INDEX idx_tracking_sessions_active ON tracking_sessions(status) WHERE status = 'active';
CREATE INDEX idx_tracking_tokens_token ON tracking_tokens(token);
CREATE INDEX idx_tracking_tokens_expiry ON tracking_tokens(expires_at);
CREATE INDEX idx_location_history_session ON tracking_location_history(session_id, recorded_at);
CREATE INDEX idx_tracking_usage_period ON tracking_usage(organization_id, period_start);

-- RLS Policies
ALTER TABLE tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY tracking_sessions_org_isolation ON tracking_sessions
    USING (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY tracking_location_history_session_access ON tracking_location_history
    USING (session_id IN (
        SELECT id FROM tracking_sessions
        WHERE organization_id = current_setting('app.organization_id', true)::uuid
    ));

CREATE POLICY tracking_tokens_job_access ON tracking_tokens
    USING (job_id IN (
        SELECT id FROM jobs
        WHERE organization_id = current_setting('app.organization_id', true)::uuid
    ));

CREATE POLICY tracking_usage_org_isolation ON tracking_usage
    USING (organization_id = current_setting('app.organization_id', true)::uuid);

-- Trigger for updated_at
CREATE TRIGGER tracking_sessions_updated_at
    BEFORE UPDATE ON tracking_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tracking_usage_updated_at
    BEFORE UPDATE ON tracking_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to generate secure tracking token
CREATE OR REPLACE FUNCTION generate_tracking_token()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..16 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for expired tokens and old history
CREATE OR REPLACE FUNCTION cleanup_tracking_data()
RETURNS void AS $$
BEGIN
    -- Delete expired tokens
    DELETE FROM tracking_tokens WHERE expires_at < NOW();

    -- Delete location history older than 7 days
    DELETE FROM tracking_location_history
    WHERE recorded_at < NOW() - INTERVAL '7 days';

    -- Complete sessions that have been inactive for 4 hours
    UPDATE tracking_sessions
    SET status = 'completed', completed_at = NOW()
    WHERE status = 'active'
    AND last_position_at < NOW() - INTERVAL '4 hours';
END;
$$ LANGUAGE plpgsql;
