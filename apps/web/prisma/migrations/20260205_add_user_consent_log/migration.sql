-- CreateTable: User Consent Log
-- Phase 9: Regulatory Compliance (Ley 25.326)
-- Tracks user consent history with version control

CREATE TABLE "user_consent_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consent_type" VARCHAR(50) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMP(3),
    "ip_address" INET,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_consent_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_consent_log_user_id_idx" ON "user_consent_log"("user_id");
CREATE INDEX "user_consent_log_consent_type_idx" ON "user_consent_log"("consent_type");
CREATE INDEX "user_consent_log_granted_at_idx" ON "user_consent_log"("granted_at");

-- AddForeignKey
ALTER TABLE "user_consent_log" ADD CONSTRAINT "user_consent_log_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comments
COMMENT ON TABLE "user_consent_log" IS 'Tracks user consent history for Ley 25.326 compliance';
COMMENT ON COLUMN "user_consent_log"."consent_type" IS 'Type: privacy_policy, terms_of_service, marketing, data_processing';
COMMENT ON COLUMN "user_consent_log"."version" IS 'Version of the policy/terms at time of consent';
COMMENT ON COLUMN "user_consent_log"."granted" IS 'true = granted, false = withdrawn';
COMMENT ON COLUMN "user_consent_log"."ip_address" IS 'IP address of user when consent was given/withdrawn';
