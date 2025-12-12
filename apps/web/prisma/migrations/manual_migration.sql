-- Migration: Add job_assignments and service_type_configs tables
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard -> SQL Editor)

-- 1. Create job_assignments table for multi-technician support
CREATE TABLE IF NOT EXISTS "job_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    -- Foreign keys
    CONSTRAINT "job_assignments_jobId_fkey" FOREIGN KEY ("jobId")
        REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "job_assignments_technicianId_fkey" FOREIGN KEY ("technicianId")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,

    -- Unique constraint: one assignment per job-technician pair
    CONSTRAINT "job_assignments_jobId_technicianId_key" UNIQUE ("jobId", "technicianId")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "job_assignments_jobId_idx" ON "job_assignments"("jobId");
CREATE INDEX IF NOT EXISTS "job_assignments_technicianId_idx" ON "job_assignments"("technicianId");

-- 2. Create service_type_configs table for configurable service types
CREATE TABLE IF NOT EXISTS "service_type_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key
    CONSTRAINT "service_type_configs_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,

    -- Unique constraint: one code per organization
    CONSTRAINT "service_type_configs_organizationId_code_key" UNIQUE ("organizationId", "code")
);

-- Create index for organization lookups
CREATE INDEX IF NOT EXISTS "service_type_configs_organizationId_idx" ON "service_type_configs"("organizationId");

-- 3. Function to generate CUID-like IDs (if not exists)
CREATE OR REPLACE FUNCTION generate_cuid() RETURNS TEXT AS $$
DECLARE
    timestamp_part TEXT;
    random_part TEXT;
BEGIN
    timestamp_part := lpad(to_hex(floor(extract(epoch from now()) * 1000)::bigint), 12, '0');
    random_part := encode(gen_random_bytes(8), 'hex');
    RETURN 'c' || timestamp_part || random_part;
END;
$$ LANGUAGE plpgsql;

-- Done! Your database now supports:
-- - Multiple technicians per job (via job_assignments table)
-- - Configurable service types per organization (via service_type_configs table)
