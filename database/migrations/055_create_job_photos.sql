-- Migration: 055_create_job_photos.sql
-- Description: Create job_photos table to replace TEXT[] array in jobs.photos
-- Replaces: jobs.photos TEXT[] column with normalized table
-- Created: 2025-01-10

-- ══════════════════════════════════════════════════════════════════════════════
-- ENUM: photo_type
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_type') THEN
        CREATE TYPE photo_type AS ENUM (
            'before',
            'during',
            'after',
            'signature',
            'document'
        );
    END IF;
END$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: job_photos
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_photos (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relations
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Photo Details
    photo_url TEXT NOT NULL,
    thumbnail_url TEXT,
    photo_type photo_type NOT NULL DEFAULT 'after',

    -- Metadata
    file_size INTEGER,                    -- Bytes
    width INTEGER,
    height INTEGER,
    mime_type TEXT,

    -- Mobile Sync Support
    local_id TEXT,                        -- Client-generated ID for offline
    sync_status sync_status DEFAULT 'synced',

    -- Timestamps
    taken_at TIMESTAMPTZ,                 -- When the photo was taken
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Primary access pattern: photos by job
CREATE INDEX IF NOT EXISTS idx_job_photos_job
    ON job_photos(job_id);

-- Sync status for mobile sync
CREATE INDEX IF NOT EXISTS idx_job_photos_sync
    ON job_photos(sync_status)
    WHERE sync_status != 'synced';

-- Photos by type (for filtering)
CREATE INDEX IF NOT EXISTS idx_job_photos_type
    ON job_photos(job_id, photo_type);

-- Local ID for deduplication during sync
CREATE INDEX IF NOT EXISTS idx_job_photos_local_id
    ON job_photos(local_id)
    WHERE local_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;

-- Photos inherit access from their parent job
CREATE POLICY job_photos_org_isolation ON job_photos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM jobs
            WHERE jobs.id = job_photos.job_id
            AND jobs.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

-- ══════════════════════════════════════════════════════════════════════════════
-- DATA MIGRATION: Transfer existing photos from jobs.photos TEXT[]
-- ══════════════════════════════════════════════════════════════════════════════

-- Migrate existing photo URLs from jobs.photos array
DO $$
DECLARE
    job_record RECORD;
    photo_url TEXT;
BEGIN
    -- Check if photos column exists in jobs table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'jobs' AND column_name = 'photos'
    ) THEN
        -- Iterate over jobs with photos
        FOR job_record IN
            SELECT id, photos
            FROM jobs
            WHERE photos IS NOT NULL AND array_length(photos, 1) > 0
        LOOP
            -- Insert each photo URL from the array
            FOREACH photo_url IN ARRAY job_record.photos
            LOOP
                INSERT INTO job_photos (job_id, photo_url, photo_type, created_at)
                VALUES (job_record.id, photo_url, 'after', NOW())
                ON CONFLICT DO NOTHING;
            END LOOP;
        END LOOP;

        RAISE NOTICE 'Migrated photos from jobs.photos column to job_photos table';
    ELSE
        RAISE NOTICE 'jobs.photos column does not exist, skipping data migration';
    END IF;
END$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE job_photos IS 'Photos associated with jobs (before, during, after, signatures)';
COMMENT ON COLUMN job_photos.photo_type IS 'Type of photo: before, during, after, signature, document';
COMMENT ON COLUMN job_photos.local_id IS 'Client-generated ID for offline photo uploads';
COMMENT ON COLUMN job_photos.sync_status IS 'Sync status for offline support';
COMMENT ON COLUMN job_photos.taken_at IS 'When the photo was taken (from EXIF or device)';
