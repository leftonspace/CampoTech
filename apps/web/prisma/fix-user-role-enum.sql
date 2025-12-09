-- SQL Fix for UserRole Enum
-- Run this in Supabase SQL Editor to fix team member creation issues
--
-- Issue: Prisma's UserRole enum may be missing values or have case mismatches
-- with the database. This script ensures all required roles exist.

-- First, let's check what UserRole enum values exist
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole');

-- Add missing values to Prisma's UserRole enum (if they don't exist)
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE,
-- so we use DO blocks to handle errors gracefully

DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OWNER';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DISPATCHER';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TECHNICIAN';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VIEWER';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Verify the enum values after update
SELECT enumlabel as role_value
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
ORDER BY enumsortorder;

-- If the above shows an error that "UserRole" doesn't exist, the database might
-- be using the lowercase version. In that case, run this query to check:
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role');

-- If using lowercase user_role from original migrations, you'll need to either:
-- 1. Update Prisma schema to use @map for enum values
-- 2. Or recreate the enum with correct values (more complex)
