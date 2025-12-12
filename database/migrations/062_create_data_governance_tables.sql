-- Migration: 062_create_data_governance_tables
-- Description: Create tables for tier enforcement, data governance, and compliance
-- Created: 2024-01-20

-- ═══════════════════════════════════════════════════════════════════════════════
-- ORGANIZATION USAGE TRACKING (Monthly Counters)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE organization_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL, -- YYYY-MM format

    -- Monthly Counters
    jobs_count INTEGER DEFAULT 0,
    invoices_count INTEGER DEFAULT 0,
    whatsapp_messages INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    storage_bytes BIGINT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_org_period UNIQUE (org_id, period)
);

CREATE INDEX idx_org_usage_org ON organization_usage(org_id);
CREATE INDEX idx_org_usage_period ON organization_usage(period);

-- Trigger for updated_at
CREATE TRIGGER update_organization_usage_updated_at
    BEFORE UPDATE ON organization_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE organization_usage IS 'Monthly usage counters per organization for tier limit enforcement';
COMMENT ON COLUMN organization_usage.period IS 'Billing period in YYYY-MM format';
COMMENT ON COLUMN organization_usage.storage_bytes IS 'Total storage used in bytes';

-- ═══════════════════════════════════════════════════════════════════════════════
-- ORGANIZATION USAGE DAILY (API Rate Limiting)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE organization_usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    api_calls INTEGER DEFAULT 0,

    CONSTRAINT unique_org_date UNIQUE (org_id, date)
);

CREATE INDEX idx_org_usage_daily_org ON organization_usage_daily(org_id);
CREATE INDEX idx_org_usage_daily_date ON organization_usage_daily(date);

-- Auto-cleanup old records (keep only 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_daily_usage()
RETURNS void AS $$
BEGIN
    DELETE FROM organization_usage_daily
    WHERE date < CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE organization_usage_daily IS 'Daily API call tracking for rate limiting';

-- ═══════════════════════════════════════════════════════════════════════════════
-- DELETION REQUESTS (Account Deletion - Ley 25.326 Compliance)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Request Details
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    confirmation_token VARCHAR(255),
    confirmed_at TIMESTAMPTZ,
    scheduled_deletion_at TIMESTAMPTZ, -- 30 days after confirmation

    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    -- pending, confirmed, processing, completed, cancelled

    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Completion
    completed_at TIMESTAMPTZ,
    completion_summary JSONB, -- What was deleted/anonymized

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT deletion_status_check CHECK (
        status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled')
    )
);

CREATE INDEX idx_deletion_requests_user ON deletion_requests(user_id);
CREATE INDEX idx_deletion_requests_status ON deletion_requests(status);
CREATE INDEX idx_deletion_requests_scheduled ON deletion_requests(scheduled_deletion_at)
    WHERE status = 'confirmed';

CREATE TRIGGER update_deletion_requests_updated_at
    BEFORE UPDATE ON deletion_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE deletion_requests IS 'Account deletion requests per Ley 25.326 (30-day waiting period)';

-- ═══════════════════════════════════════════════════════════════════════════════
-- USER PRIVACY PREFERENCES (Right of Opposition)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE user_privacy_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

    -- Consent Options
    marketing_emails BOOLEAN DEFAULT true,
    activity_tracking BOOLEAN DEFAULT true,
    ai_training BOOLEAN DEFAULT false, -- Never use customer data for training
    location_history BOOLEAN DEFAULT true, -- For technicians

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_privacy_prefs_user ON user_privacy_preferences(user_id);

CREATE TRIGGER update_privacy_preferences_updated_at
    BEFORE UPDATE ON user_privacy_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_privacy_preferences IS 'User data processing opt-outs per Ley 25.326';

-- ═══════════════════════════════════════════════════════════════════════════════
-- DATA EXPORT REQUESTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE data_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Request Details
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending',
    -- pending, processing, completed, failed, expired

    -- Processing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER,

    -- Result
    download_url TEXT,
    file_size_bytes BIGINT,
    expires_at TIMESTAMPTZ, -- 7 days after completion
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,

    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT export_status_check CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'expired')
    )
);

CREATE INDEX idx_export_requests_user ON data_export_requests(user_id);
CREATE INDEX idx_export_requests_status ON data_export_requests(status);
CREATE INDEX idx_export_requests_expires ON data_export_requests(expires_at)
    WHERE status = 'completed';

CREATE TRIGGER update_data_export_requests_updated_at
    BEFORE UPDATE ON data_export_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Rate limit: 1 export per 24 hours per user
CREATE OR REPLACE FUNCTION check_export_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM data_export_requests
        WHERE user_id = NEW.user_id
        AND created_at > NOW() - INTERVAL '24 hours'
        AND status != 'expired'
    ) THEN
        RAISE EXCEPTION 'Rate limit exceeded: Only one export per 24 hours allowed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_export_rate_limit
    BEFORE INSERT ON data_export_requests
    FOR EACH ROW
    EXECUTE FUNCTION check_export_rate_limit();

COMMENT ON TABLE data_export_requests IS 'User data export requests (Right of Access)';

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOCUMENT VERSIONS (Version History for Documents)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Entity Reference
    entity_type VARCHAR(50) NOT NULL, -- vehicle, organization, user
    entity_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- vtv, insurance, cedula_verde, titulo, dni, cuil_constancia, etc.

    -- File Information
    file_url TEXT NOT NULL,
    file_size_bytes INTEGER,
    original_filename VARCHAR(255),
    mime_type VARCHAR(100),

    -- Upload Details
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),

    -- Validity Period
    valid_from DATE,
    expires_at DATE,

    -- Version Control
    is_current BOOLEAN DEFAULT true,
    version_number INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES document_versions(id),

    -- Metadata
    metadata JSONB DEFAULT '{}', -- CAE, policy number, etc.

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_versions_entity ON document_versions(entity_type, entity_id);
CREATE INDEX idx_doc_versions_type ON document_versions(document_type);
CREATE INDEX idx_doc_versions_current ON document_versions(entity_type, entity_id, document_type)
    WHERE is_current = true;
CREATE INDEX idx_doc_versions_expires ON document_versions(expires_at)
    WHERE expires_at IS NOT NULL;

-- Auto-set previous version to not current on new version insert
CREATE OR REPLACE FUNCTION handle_new_document_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark previous versions as not current
    UPDATE document_versions
    SET is_current = false
    WHERE entity_type = NEW.entity_type
    AND entity_id = NEW.entity_id
    AND document_type = NEW.document_type
    AND is_current = true
    AND id != NEW.id;

    -- Set version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO NEW.version_number
    FROM document_versions
    WHERE entity_type = NEW.entity_type
    AND entity_id = NEW.entity_id
    AND document_type = NEW.document_type;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_document_version
    BEFORE INSERT ON document_versions
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_document_version();

COMMENT ON TABLE document_versions IS 'Version history for all document uploads (never delete for compliance)';

-- ═══════════════════════════════════════════════════════════════════════════════
-- PENDING APPROVALS (Approval Workflow)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE pending_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Entity Reference
    entity_type VARCHAR(50) NOT NULL, -- organization, user, customer, vehicle, job
    entity_id UUID NOT NULL,
    field_name VARCHAR(100) NOT NULL,

    -- Values
    current_value JSONB,
    requested_value JSONB NOT NULL,

    -- Request Details
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    -- pending, approved, rejected

    -- Review Details
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT approval_status_check CHECK (
        status IN ('pending', 'approved', 'rejected')
    )
);

CREATE INDEX idx_approvals_org ON pending_approvals(org_id);
CREATE INDEX idx_approvals_status ON pending_approvals(status);
CREATE INDEX idx_approvals_entity ON pending_approvals(entity_type, entity_id);
CREATE INDEX idx_approvals_pending ON pending_approvals(org_id, status)
    WHERE status = 'pending';

CREATE TRIGGER update_pending_approvals_updated_at
    BEFORE UPDATE ON pending_approvals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE pending_approvals IS 'Pending field change approvals requiring OWNER review';

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHANGE REQUESTS (Enhanced from Part 1)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Request Reference
    request_number VARCHAR(20) UNIQUE NOT NULL,

    -- Entity Information
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    field_name VARCHAR(100) NOT NULL,

    -- Values
    current_value TEXT,
    requested_value TEXT NOT NULL,
    reason TEXT,

    -- Documentation
    required_documents TEXT[] DEFAULT '{}',
    submitted_documents JSONB DEFAULT '[]',
    -- Format: [{ type, url, uploaded_at, verified }]

    -- SLA
    sla_hours INTEGER DEFAULT 72,
    sla_deadline TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    -- pending, documents_required, under_review, approved, rejected

    -- Request Details
    requested_by UUID REFERENCES users(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),

    -- Admin Processing
    admin_notes TEXT, -- Internal notes, not shown to requester
    reviewed_by VARCHAR(255), -- Admin identifier
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Completion
    applied_at TIMESTAMPTZ,
    applied_by UUID REFERENCES users(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT change_request_status_check CHECK (
        status IN ('pending', 'documents_required', 'under_review', 'approved', 'rejected')
    )
);

-- Generate request number
CREATE OR REPLACE FUNCTION generate_change_request_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix VARCHAR(4);
    sequence_num INTEGER;
BEGIN
    year_prefix := TO_CHAR(NOW(), 'YYYY');

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(request_number FROM 8) AS INTEGER)
    ), 0) + 1 INTO sequence_num
    FROM change_requests
    WHERE request_number LIKE 'CR-' || year_prefix || '-%';

    NEW.request_number := 'CR-' || year_prefix || '-' || LPAD(sequence_num::TEXT, 5, '0');

    -- Calculate SLA deadline
    IF NEW.sla_hours IS NOT NULL THEN
        NEW.sla_deadline := NEW.created_at + (NEW.sla_hours || ' hours')::INTERVAL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_change_request_number
    BEFORE INSERT ON change_requests
    FOR EACH ROW
    EXECUTE FUNCTION generate_change_request_number();

CREATE INDEX idx_change_requests_org ON change_requests(org_id);
CREATE INDEX idx_change_requests_status ON change_requests(status);
CREATE INDEX idx_change_requests_sla ON change_requests(sla_deadline)
    WHERE status IN ('pending', 'under_review');
CREATE INDEX idx_change_requests_number ON change_requests(request_number);

CREATE TRIGGER update_change_requests_updated_at
    BEFORE UPDATE ON change_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE change_requests IS 'Formal change requests requiring documentation and admin review';

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUDIT LOG ARCHIVES (For 10+ year records)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE audit_log_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,

    -- Archive Period
    archive_period VARCHAR(7) NOT NULL, -- YYYY-MM
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Archive Details
    record_count INTEGER NOT NULL,
    file_path TEXT NOT NULL, -- Path to compressed JSON file
    file_size_bytes BIGINT,
    checksum VARCHAR(64), -- SHA-256 of file

    -- Status
    status VARCHAR(20) DEFAULT 'active',
    -- active, archived, deleted

    -- Timestamps
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_archives_org ON audit_log_archives(org_id);
CREATE INDEX idx_audit_archives_period ON audit_log_archives(archive_period);

COMMENT ON TABLE audit_log_archives IS 'Index to archived audit logs stored in cold storage';

-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTIFICATION QUEUE (For approvals, change requests, etc.)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Notification Content
    type VARCHAR(50) NOT NULL,
    -- approval_required, approval_result, change_request_update,
    -- limit_warning, limit_exceeded, data_export_ready, deletion_scheduled

    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,

    -- Reference
    reference_type VARCHAR(50), -- pending_approval, change_request, etc.
    reference_id UUID,

    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    is_dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMPTZ,

    -- Delivery
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON user_notifications(user_id);
CREATE INDEX idx_notifications_unread ON user_notifications(user_id, is_read)
    WHERE is_read = false;
CREATE INDEX idx_notifications_type ON user_notifications(type);

COMMENT ON TABLE user_notifications IS 'In-app notifications for users';

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all new tables
ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privacy_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Usage tables: only org members can read
CREATE POLICY org_usage_org_access ON organization_usage
    FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_usage_daily_org_access ON organization_usage_daily
    FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Privacy preferences: only own user
CREATE POLICY privacy_prefs_user_access ON user_privacy_preferences
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Export requests: only own user
CREATE POLICY export_requests_user_access ON data_export_requests
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Deletion requests: only own user
CREATE POLICY deletion_requests_user_access ON deletion_requests
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Document versions: org members
CREATE POLICY doc_versions_org_access ON document_versions
    FOR SELECT USING (true); -- Will be filtered by app logic based on entity

-- Pending approvals: org members (filtered by role in app)
CREATE POLICY approvals_org_access ON pending_approvals
    FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Change requests: org members
CREATE POLICY change_requests_org_access ON change_requests
    FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Notifications: only own user
CREATE POLICY notifications_user_access ON user_notifications
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CLEANUP FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Cleanup expired data export files
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS void AS $$
BEGIN
    UPDATE data_export_requests
    SET status = 'expired', download_url = NULL
    WHERE status = 'completed'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Process pending deletions
CREATE OR REPLACE FUNCTION process_pending_deletions()
RETURNS INTEGER AS $$
DECLARE
    processed_count INTEGER := 0;
BEGIN
    -- This is a placeholder - actual deletion logic would be more complex
    -- Mark requests as processing
    UPDATE deletion_requests
    SET status = 'processing', updated_at = NOW()
    WHERE status = 'confirmed'
    AND scheduled_deletion_at <= NOW();

    GET DIAGNOSTICS processed_count = ROW_COUNT;
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON FUNCTION cleanup_old_daily_usage() IS 'Cleanup daily usage records older than 7 days';
COMMENT ON FUNCTION cleanup_expired_exports() IS 'Mark expired data exports and clear URLs';
COMMENT ON FUNCTION process_pending_deletions() IS 'Process account deletions past 30-day waiting period';
