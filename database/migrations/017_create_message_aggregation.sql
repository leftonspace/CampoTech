-- Migration 017: Create message aggregation tables
-- Phase 9.8: WhatsApp Message Aggregation System

-- Conversation context for returning customers
CREATE TABLE conversation_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    customer_phone TEXT NOT NULL,

    -- Last 10 messages for context
    message_history JSONB DEFAULT '[]',

    -- Customer identification
    customer_id UUID REFERENCES customers(id),
    customer_name TEXT,

    -- Active job reference
    active_job_id UUID REFERENCES jobs(id),

    -- Service history for context
    previous_requests TEXT[],

    -- Timestamps
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Auto-expire after 24 hours of inactivity
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',

    UNIQUE(organization_id, customer_phone)
);

-- Message aggregation buffer status (for monitoring, actual buffers in Redis)
CREATE TABLE message_buffer_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Buffer statistics
    total_buffers_created INTEGER DEFAULT 0,
    total_messages_aggregated INTEGER DEFAULT 0,
    total_immediate_triggers INTEGER DEFAULT 0,
    total_timeout_triggers INTEGER DEFAULT 0,

    -- Average metrics
    avg_buffer_size DECIMAL(5, 2) DEFAULT 0,
    avg_aggregation_time_ms INTEGER DEFAULT 0,

    -- Daily tracking
    date DATE NOT NULL DEFAULT CURRENT_DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, date)
);

-- Indexes
CREATE INDEX idx_conversation_contexts_phone ON conversation_contexts(organization_id, customer_phone);
CREATE INDEX idx_conversation_contexts_expiry ON conversation_contexts(expires_at);
CREATE INDEX idx_conversation_contexts_customer ON conversation_contexts(customer_id);
CREATE INDEX idx_message_buffer_stats_date ON message_buffer_stats(organization_id, date);

-- RLS Policies
ALTER TABLE conversation_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_buffer_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_contexts_org_isolation ON conversation_contexts
    USING (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY message_buffer_stats_org_isolation ON message_buffer_stats
    USING (organization_id = current_setting('app.organization_id', true)::uuid);

-- Trigger for updated_at
CREATE TRIGGER conversation_contexts_updated_at
    BEFORE UPDATE ON conversation_contexts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER message_buffer_stats_updated_at
    BEFORE UPDATE ON message_buffer_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Cleanup function for expired contexts
CREATE OR REPLACE FUNCTION cleanup_expired_contexts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM conversation_contexts
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
