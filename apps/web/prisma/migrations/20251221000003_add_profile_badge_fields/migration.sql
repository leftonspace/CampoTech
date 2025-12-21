-- Add badge fields to BusinessPublicProfile for marketplace display
-- These fields are synced from VerificationSubmission when verifications are approved

-- Add core badge fields (matching consumer-mobile VerificationBadges interface)
ALTER TABLE "business_public_profiles"
ADD COLUMN IF NOT EXISTS "background_check" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "business_public_profiles"
ADD COLUMN IF NOT EXISTS "professional_license" BOOLEAN NOT NULL DEFAULT false;

-- Add optional badges JSON array for Tier 4 badges
-- Format: [{"code":"gasista_matriculado","icon":"flame","label":"Gasista Matriculado"}, ...]
ALTER TABLE "business_public_profiles"
ADD COLUMN IF NOT EXISTS "optional_badges" JSONB NOT NULL DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN "business_public_profiles"."background_check" IS 'Antecedentes verificados - synced from verification_submissions';
COMMENT ON COLUMN "business_public_profiles"."professional_license" IS 'Has any professional license (gasista, electricista, plomero) - synced from verification_submissions';
COMMENT ON COLUMN "business_public_profiles"."optional_badges" IS 'Array of approved Tier 4 optional badges with code, icon, and label';
