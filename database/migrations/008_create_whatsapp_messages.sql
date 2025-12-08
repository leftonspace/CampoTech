-- Migration: 008_create_whatsapp_messages
-- Description: Create whatsapp_messages table
-- Created: 2024-01-15

CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

    -- WhatsApp IDs
    wa_message_id TEXT UNIQUE,
    wa_conversation_id TEXT,

    -- Content
    direction message_direction NOT NULL,
    message_type message_type NOT NULL,
    content TEXT,
    media_url TEXT,
    template_name TEXT,

    -- Voice processing
    voice_duration INTEGER,  -- seconds
    transcription TEXT,
    extraction_data JSONB,
    extraction_confidence DECIMAL(3, 2),
    voice_processing_status voice_processing_status,

    -- Status
    status message_status DEFAULT 'queued',
    error_code TEXT,

    -- Idempotency
    idempotency_key TEXT UNIQUE,

    -- Timestamps
    wa_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_org ON whatsapp_messages(org_id);
CREATE INDEX idx_messages_customer ON whatsapp_messages(customer_id);
CREATE INDEX idx_messages_job ON whatsapp_messages(job_id);
CREATE INDEX idx_messages_wa_id ON whatsapp_messages(wa_message_id);
CREATE INDEX idx_messages_status ON whatsapp_messages(org_id, status);
CREATE INDEX idx_messages_voice_status ON whatsapp_messages(voice_processing_status)
    WHERE voice_processing_status IS NOT NULL;
CREATE INDEX idx_messages_created ON whatsapp_messages(created_at);

-- Row Level Security
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_org_isolation ON whatsapp_messages
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Comments
COMMENT ON TABLE whatsapp_messages IS 'WhatsApp message history';
COMMENT ON COLUMN whatsapp_messages.extraction_data IS 'Voice AI extracted entities';
COMMENT ON COLUMN whatsapp_messages.extraction_confidence IS 'Overall confidence score 0-1';
