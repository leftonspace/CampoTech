-- Phase 5.1.1: Database Index Audit
-- This migration adds composite indexes for common query patterns
-- to optimize performance for 100,000+ businesses scale

-- ═══════════════════════════════════════════════════════════════════════════════
-- JOBS TABLE - Composite indexes for common query patterns
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for filtering jobs by organization and status (most common query)
CREATE INDEX IF NOT EXISTS "idx_jobs_org_status" ON "jobs"("organizationId", "status");

-- Index for filtering jobs by organization and scheduled date (calendar views)
CREATE INDEX IF NOT EXISTS "idx_jobs_org_scheduled_date" ON "jobs"("organizationId", "scheduledDate");

-- Index for filtering technician's jobs by status (technician dashboard)
CREATE INDEX IF NOT EXISTS "idx_jobs_technician_status" ON "jobs"("technicianId", "status");

-- ═══════════════════════════════════════════════════════════════════════════════
-- REVIEWS TABLE - Composite indexes for marketplace queries
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for aggregating ratings by organization (marketplace listing)
CREATE INDEX IF NOT EXISTS "idx_reviews_org_rating" ON "reviews"("organizationId", "rating");

-- ═══════════════════════════════════════════════════════════════════════════════
-- EMPLOYEE SCHEDULES TABLE - Composite indexes for availability queries
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for finding available employees on a specific day
CREATE INDEX IF NOT EXISTS "idx_employee_schedules_org_day" ON "employee_schedules"("organizationId", "dayOfWeek");

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEDULE EXCEPTIONS TABLE - Composite indexes for exception queries
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for finding all exceptions on a specific date
CREATE INDEX IF NOT EXISTS "idx_schedule_exceptions_org_date" ON "schedule_exceptions"("organizationId", "date");

-- ═══════════════════════════════════════════════════════════════════════════════
-- BUSINESS PUBLIC PROFILES TABLE - New table for marketplace
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create the business_public_profiles table
CREATE TABLE IF NOT EXISTS "business_public_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "coverPhoto" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "services" JSONB NOT NULL DEFAULT '[]',
    "serviceArea" JSONB,
    "address" TEXT,
    "whatsappNumber" TEXT NOT NULL,
    "phone" TEXT,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "totalJobs" INTEGER NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseTime" INTEGER NOT NULL DEFAULT 0,
    "cuitVerified" BOOLEAN NOT NULL DEFAULT false,
    "insuranceVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_public_profiles_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on organizationId
CREATE UNIQUE INDEX IF NOT EXISTS "business_public_profiles_organizationId_key" ON "business_public_profiles"("organizationId");

-- Create index on averageRating for sorting
CREATE INDEX IF NOT EXISTS "idx_profiles_average_rating" ON "business_public_profiles"("averageRating");

-- Create index on isActive for filtering
CREATE INDEX IF NOT EXISTS "idx_profiles_is_active" ON "business_public_profiles"("isActive");

-- Create composite index for active profiles sorted by rating (marketplace search)
CREATE INDEX IF NOT EXISTS "idx_profiles_active_rating" ON "business_public_profiles"("isActive", "averageRating" DESC);

-- Create GIN index on categories array for fast array containment queries
-- This enables efficient queries like: WHERE 'plomeria' = ANY(categories)
CREATE INDEX IF NOT EXISTS "idx_profiles_categories_gin" ON "business_public_profiles" USING GIN ("categories");

-- Add foreign key constraint to organizations table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'business_public_profiles_organizationId_fkey'
    ) THEN
        ALTER TABLE "business_public_profiles"
        ADD CONSTRAINT "business_public_profiles_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
