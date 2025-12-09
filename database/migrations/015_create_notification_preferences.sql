-- Migration 015: Create notification preferences table
-- Phase 9.6: Notification Preferences System

-- Notification event types
CREATE TYPE notification_event_type AS ENUM (
    'job_assigned',
    'job_updated',
    'job_reminder',
    'job_completed',
    'job_cancelled',
    'invoice_created',
    'invoice_sent',
    'payment_received',
    'payment_failed',
    'team_member_added',
    'team_member_removed',
    'sync_conflict',
    'system_alert',
    'employee_welcome',
    'schedule_change',
    'custom'
);

-- Notification delivery channel
CREATE TYPE notification_channel AS ENUM (
    'web',
    'push',
    'sms',
    'email',
    'whatsapp'
);

-- User notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Channel preferences (WhatsApp-first for Argentina)
    web_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    email_enabled BOOLEAN DEFAULT false,
    whatsapp_enabled BOOLEAN DEFAULT true,

    -- Event type preferences (JSON for flexibility) - Argentine defaults
    event_preferences JSONB DEFAULT '{
        "job_assigned": {"whatsapp": true, "push": true, "email": false, "sms": false},
        "job_reminder": {"whatsapp": true, "push": true, "email": false, "sms": false},
        "job_completed": {"whatsapp": true, "push": true, "email": false, "sms": false},
        "schedule_change": {"whatsapp": true, "push": true, "email": false, "sms": false},
        "invoice_created": {"whatsapp": true, "push": false, "email": true, "sms": false},
        "payment_received": {"whatsapp": true, "push": true, "email": false, "sms": false},
        "team_member_added": {"whatsapp": true, "push": false, "email": false, "sms": false},
        "system_alert": {"whatsapp": true, "push": true, "email": true, "sms": true}
    }',

    -- Reminder timing preferences (minutes before)
    reminder_intervals JSONB DEFAULT '[1440, 60, 30]',

    -- Quiet hours (don't disturb)
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    quiet_hours_timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

-- Notification logs for delivery tracking
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),

    event_type notification_event_type NOT NULL,
    channel notification_channel NOT NULL,

    -- Content
    title TEXT,
    body TEXT,
    data JSONB DEFAULT '{}',

    -- Delivery status
    status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed, read
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    error_message TEXT,

    -- Reference
    entity_type TEXT,
    entity_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled reminders for jobs
CREATE TABLE scheduled_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),

    -- Reminder details
    reminder_type TEXT NOT NULL, -- '24h', '1h', '30min'
    scheduled_for TIMESTAMPTZ NOT NULL,

    -- Status
    status TEXT DEFAULT 'pending', -- pending, sent, cancelled
    sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_org ON notification_preferences(organization_id);
CREATE INDEX idx_notification_logs_user ON notification_logs(user_id, created_at);
CREATE INDEX idx_notification_logs_status ON notification_logs(status, created_at);
CREATE INDEX idx_scheduled_reminders_due ON scheduled_reminders(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_scheduled_reminders_job ON scheduled_reminders(job_id);

-- RLS Policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_org_isolation ON notification_preferences
    USING (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY notification_logs_org_isolation ON notification_logs
    USING (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY scheduled_reminders_org_isolation ON scheduled_reminders
    USING (organization_id = current_setting('app.organization_id', true)::uuid);

-- Trigger for updated_at
CREATE TRIGGER notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
