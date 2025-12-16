-- Migration: Add Employee Scheduling
-- Phase 1.5 - Employee Scheduling System
--
-- Run this migration after simplify-roles-to-3.sql
-- Command: npx prisma db execute --file prisma/migrations/manual/add-employee-scheduling.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- CREATE TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Weekly recurring schedule
CREATE TABLE IF NOT EXISTS "employee_schedules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
    "startTime" TEXT NOT NULL, -- "09:00" (24h format)
    "endTime" TEXT NOT NULL, -- "18:00"
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_schedules_pkey" PRIMARY KEY ("id")
);

-- One-time exceptions (day off, vacation, etc.)
CREATE TABLE IF NOT EXISTS "schedule_exceptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false, -- false = day off
    "reason" TEXT, -- "Vacaciones", "Enfermedad", etc.
    "startTime" TEXT, -- Optional: if available but different hours
    "endTime" TEXT, -- Optional: if available but different hours
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CREATE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Employee schedules indexes
CREATE UNIQUE INDEX IF NOT EXISTS "employee_schedules_userId_dayOfWeek_key"
    ON "employee_schedules"("userId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "employee_schedules_organizationId_idx"
    ON "employee_schedules"("organizationId");
CREATE INDEX IF NOT EXISTS "employee_schedules_userId_idx"
    ON "employee_schedules"("userId");

-- Schedule exceptions indexes
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_exceptions_userId_date_key"
    ON "schedule_exceptions"("userId", "date");
CREATE INDEX IF NOT EXISTS "schedule_exceptions_organizationId_idx"
    ON "schedule_exceptions"("organizationId");
CREATE INDEX IF NOT EXISTS "schedule_exceptions_userId_idx"
    ON "schedule_exceptions"("userId");
CREATE INDEX IF NOT EXISTS "schedule_exceptions_date_idx"
    ON "schedule_exceptions"("date");

-- ═══════════════════════════════════════════════════════════════════════════════
-- ADD FOREIGN KEYS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Employee schedules foreign keys
ALTER TABLE "employee_schedules"
    ADD CONSTRAINT "employee_schedules_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_schedules"
    ADD CONSTRAINT "employee_schedules_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Schedule exceptions foreign keys
ALTER TABLE "schedule_exceptions"
    ADD CONSTRAINT "schedule_exceptions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_exceptions"
    ADD CONSTRAINT "schedule_exceptions_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Verify tables were created
-- SELECT 'employee_schedules' as table_name, COUNT(*) as row_count FROM employee_schedules
-- UNION ALL
-- SELECT 'schedule_exceptions' as table_name, COUNT(*) as row_count FROM schedule_exceptions;
