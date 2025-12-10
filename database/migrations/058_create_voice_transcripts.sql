-- Migration: 058_create_voice_transcripts.sql
-- Description: Create voice_transcripts table to replace inline columns in whatsapp_messages
-- Replaces: whatsapp_messages voice processing columns (transcription, extraction_data, etc.)
-- Created: 2025-01-10

-- ══════════════════════════════════════════════════════════════════════════════
-- ENUM: voice_status (if not exists - may be named voice_processing_status)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voice_status') THEN
        CREATE TYPE voice_status AS ENUM (
            'pending',
            'transcribing',
            'extracting',
            'completed',
            'needs_review',
            'reviewed',
            'failed'
        );
    END IF;
END$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: voice_transcripts
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS voice_transcripts (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relations
    message_id UUID NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

    -- Audio Info
    audio_url TEXT NOT NULL,
    audio_duration INTEGER,               -- Seconds
    audio_quality TEXT,                   -- 'clean', 'noisy', 'poor'
    audio_language TEXT DEFAULT 'es',     -- Detected or assumed language

    -- Transcription (AI Generated)
    transcription TEXT,
    transcription_model TEXT,             -- e.g., 'whisper-1', 'whisper-large-v3'
    transcription_confidence DECIMAL(3, 2),
    transcription_segments JSONB,         -- Array of {start, end, text, confidence}

    -- Extraction (AI Extracted Entities)
    extraction_data JSONB,                -- Structured extraction result
    extraction_model TEXT,                -- e.g., 'gpt-4o', 'claude-3-sonnet'
    overall_confidence DECIMAL(3, 2),

    -- Human Review
    human_transcription TEXT,             -- Corrected transcription by human
    human_extraction JSONB,               -- Corrected extraction by human
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Status
    status voice_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    error_code TEXT,

    -- Processing Metrics
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,

    -- Job Creation
    auto_created BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Primary access pattern: transcript by message
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_transcripts_message
    ON voice_transcripts(message_id);

-- Transcripts by status (for processing queue)
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_status
    ON voice_transcripts(status);

-- Pending review queue
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_review
    ON voice_transcripts(status, created_at)
    WHERE status = 'needs_review';

-- Failed transcripts for retry
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_failed
    ON voice_transcripts(status, retry_count)
    WHERE status = 'failed' AND retry_count < 3;

-- Jobs created from voice
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_job
    ON voice_transcripts(created_job_id)
    WHERE created_job_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- Updated_at trigger
CREATE TRIGGER update_voice_transcripts_updated_at
    BEFORE UPDATE ON voice_transcripts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;

-- Transcripts inherit access from their parent message
CREATE POLICY voice_transcripts_org_isolation ON voice_transcripts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM whatsapp_messages
            WHERE whatsapp_messages.id = voice_transcripts.message_id
            AND whatsapp_messages.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to get transcripts needing review
CREATE OR REPLACE FUNCTION get_pending_voice_reviews(p_org_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    transcript_id UUID,
    message_id UUID,
    audio_url TEXT,
    audio_duration INTEGER,
    transcription TEXT,
    extraction_data JSONB,
    overall_confidence DECIMAL(3, 2),
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vt.id AS transcript_id,
        vt.message_id,
        vt.audio_url,
        vt.audio_duration,
        vt.transcription,
        vt.extraction_data,
        vt.overall_confidence,
        vt.created_at
    FROM voice_transcripts vt
    JOIN whatsapp_messages wm ON wm.id = vt.message_id
    WHERE wm.org_id = p_org_id
        AND vt.status = 'needs_review'
    ORDER BY vt.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate voice processing statistics
CREATE OR REPLACE FUNCTION get_voice_processing_stats(p_org_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_processed INTEGER,
    auto_approved INTEGER,
    needs_review INTEGER,
    reviewed INTEGER,
    failed INTEGER,
    avg_confidence DECIMAL(3, 2),
    avg_processing_ms INTEGER,
    auto_create_rate DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER AS total_processed,
        COUNT(*) FILTER (WHERE vt.status = 'completed' AND vt.auto_created = true)::INTEGER AS auto_approved,
        COUNT(*) FILTER (WHERE vt.status = 'needs_review')::INTEGER AS needs_review,
        COUNT(*) FILTER (WHERE vt.status = 'reviewed')::INTEGER AS reviewed,
        COUNT(*) FILTER (WHERE vt.status = 'failed')::INTEGER AS failed,
        ROUND(AVG(vt.overall_confidence)::DECIMAL, 2) AS avg_confidence,
        ROUND(AVG(vt.processing_duration_ms))::INTEGER AS avg_processing_ms,
        ROUND((COUNT(*) FILTER (WHERE vt.auto_created = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2) AS auto_create_rate
    FROM voice_transcripts vt
    JOIN whatsapp_messages wm ON wm.id = vt.message_id
    WHERE wm.org_id = p_org_id
        AND vt.created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE voice_transcripts IS 'Voice message transcriptions and AI extractions';
COMMENT ON COLUMN voice_transcripts.message_id IS 'Reference to original WhatsApp voice message';
COMMENT ON COLUMN voice_transcripts.transcription IS 'AI-generated transcription of voice message';
COMMENT ON COLUMN voice_transcripts.extraction_data IS 'Structured data extracted by AI (customer name, address, service type, etc.)';
COMMENT ON COLUMN voice_transcripts.human_transcription IS 'Human-corrected transcription for review workflow';
COMMENT ON COLUMN voice_transcripts.overall_confidence IS 'Combined confidence score (0-1) for transcription and extraction';
COMMENT ON COLUMN voice_transcripts.auto_created IS 'Whether a job was automatically created from this voice message';
COMMENT ON COLUMN voice_transcripts.created_job_id IS 'Reference to job created from this voice message';
