-- Migration: 005_create_jobs
-- Description: Create jobs table
-- Created: 2024-01-15

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Job info
    title TEXT NOT NULL,
    description TEXT,
    job_type job_type,
    priority priority_level DEFAULT 'normal',

    -- Status
    status job_status DEFAULT 'pending',
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Scheduling
    scheduled_date DATE,
    scheduled_time_start TIME,
    scheduled_time_end TIME,
    estimated_duration INTEGER,  -- minutes

    -- Actual times
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,

    -- Location
    address TEXT,
    address_extra TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),

    -- Completion
    photos TEXT[],  -- URLs
    notes TEXT,
    internal_notes TEXT,
    signature_url TEXT,

    -- Billing
    invoice_id UUID,  -- Will add FK after invoices table created

    -- Source tracking
    source record_source DEFAULT 'manual',
    source_message_id TEXT,

    -- Offline support
    local_id TEXT,  -- Mobile-generated ID for offline
    sync_status sync_status DEFAULT 'synced',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_jobs_org_status ON jobs(org_id, status);
CREATE INDEX idx_jobs_org_date ON jobs(org_id, scheduled_date);
CREATE INDEX idx_jobs_assigned ON jobs(assigned_to, scheduled_date);
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_jobs_status_changed ON jobs(status_changed_at);
CREATE INDEX idx_jobs_sync_status ON jobs(org_id, sync_status) WHERE sync_status != 'synced';

-- Trigger for updated_at
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for status_changed_at
CREATE OR REPLACE FUNCTION update_job_status_changed()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.status_changed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jobs_status_changed
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_job_status_changed();

-- Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_org_isolation ON jobs
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Technicians can only see their assigned jobs (select only)
CREATE POLICY job_technician_view ON jobs
    FOR SELECT
    USING (
        org_id = current_setting('app.current_org_id', true)::uuid
        AND (
            current_setting('app.current_user_role', true) IN ('owner', 'admin', 'dispatcher')
            OR assigned_to = current_setting('app.current_user_id', true)::uuid
        )
    );

-- Comments
COMMENT ON TABLE jobs IS 'Service jobs/work orders';
COMMENT ON COLUMN jobs.local_id IS 'Client-generated ID for offline creation';
COMMENT ON COLUMN jobs.sync_status IS 'Offline sync status';
