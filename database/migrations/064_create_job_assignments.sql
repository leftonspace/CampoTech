-- Migration: 064_create_job_assignments
-- Description: Create job_assignments table for many-to-many relationship between jobs and technicians
-- Created: 2025-12-12
-- Note: This migration is idempotent - safe to run multiple times

-- ═══════════════════════════════════════════════════════════════════════════════
-- JOB ASSIGNMENTS (Many-to-Many: Jobs <-> Technicians)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Only create if not exists (table may already exist)
CREATE TABLE IF NOT EXISTS job_assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    technician_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Assignment Info
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Add unique constraint if not exists (ignore error if already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_job_technician'
    ) THEN
        ALTER TABLE job_assignments ADD CONSTRAINT unique_job_technician UNIQUE (job_id, technician_id);
    END IF;
END $$;

-- Indexes (use IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS idx_job_assignments_job ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_technician ON job_assignments(technician_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_assigned_at ON job_assignments(assigned_at);

-- Comments
COMMENT ON TABLE job_assignments IS 'Many-to-many relationship for assigning multiple technicians to jobs';
COMMENT ON COLUMN job_assignments.job_id IS 'Reference to the job';
COMMENT ON COLUMN job_assignments.technician_id IS 'Reference to the assigned technician (user with TECHNICIAN role)';
COMMENT ON COLUMN job_assignments.assigned_at IS 'When the technician was assigned to this job';
COMMENT ON COLUMN job_assignments.notes IS 'Optional notes about the assignment';
