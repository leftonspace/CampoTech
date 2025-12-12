-- Migration: Fix service_type_configs table schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard -> SQL Editor)
-- This adds missing columns if they don't exist

-- Add isActive column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_type_configs' AND column_name = 'isActive'
    ) THEN
        ALTER TABLE "service_type_configs" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- Add sortOrder column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_type_configs' AND column_name = 'sortOrder'
    ) THEN
        ALTER TABLE "service_type_configs" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add description column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_type_configs' AND column_name = 'description'
    ) THEN
        ALTER TABLE "service_type_configs" ADD COLUMN "description" TEXT;
    END IF;
END $$;

-- Add color column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_type_configs' AND column_name = 'color'
    ) THEN
        ALTER TABLE "service_type_configs" ADD COLUMN "color" TEXT;
    END IF;
END $$;

-- Add icon column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_type_configs' AND column_name = 'icon'
    ) THEN
        ALTER TABLE "service_type_configs" ADD COLUMN "icon" TEXT;
    END IF;
END $$;

-- If the table doesn't exist at all, create it
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

    CONSTRAINT "service_type_configs_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "service_type_configs_organizationId_code_key" UNIQUE ("organizationId", "code")
);

CREATE INDEX IF NOT EXISTS "service_type_configs_organizationId_idx" ON "service_type_configs"("organizationId");

-- Verify the fix
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'service_type_configs'
ORDER BY ordinal_position;
