-- Migration: 064_create_job_assignments
-- Description: Create job_assignments table for many-to-many relationship between jobs and technicians
-- Created: 2025-12-12

-- ═══════════════════════════════════════════════════════════════════════════════
-- JOB ASSIGNMENTS (Many-to-Many: Jobs <-> Technicians)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE job_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Assignment Info
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,

    -- Unique constraint: one assignment per job-technician pair
    CONSTRAINT unique_job_technician UNIQUE (job_id, technician_id)
);

-- Indexes
CREATE INDEX idx_job_assignments_job ON job_assignments(job_id);
CREATE INDEX idx_job_assignments_technician ON job_assignments(technician_id);
CREATE INDEX idx_job_assignments_assigned_at ON job_assignments(assigned_at);

-- Comments
COMMENT ON TABLE job_assignments IS 'Many-to-many relationship for assigning multiple technicians to jobs';
COMMENT ON COLUMN job_assignments.job_id IS 'Reference to the job';
COMMENT ON COLUMN job_assignments.technician_id IS 'Reference to the assigned technician (user with TECHNICIAN role)';
COMMENT ON COLUMN job_assignments.assigned_at IS 'When the technician was assigned to this job';
COMMENT ON COLUMN job_assignments.notes IS 'Optional notes about the assignment';
