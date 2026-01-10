/*
  Warnings:

  - A unique constraint covering the columns `[badge_token]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "bsp_provisioning_status" AS ENUM ('not_provisioned', 'pending', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "unclaimed_profile_source" AS ENUM ('ERSEP', 'CACAAV', 'GASNOR', 'GASNEA', 'ENARGAS', 'MANUAL');

-- CreateEnum
CREATE TYPE "outreach_status" AS ENUM ('not_contacted', 'verification_sent', 'contacted', 'engaged', 'claimed', 'unsubscribed', 'invalid');

-- CreateEnum
CREATE TYPE "data_quality" AS ENUM ('raw', 'cleaned', 'verified', 'enriched');

-- CreateEnum
CREATE TYPE "whatsapp_status" AS ENUM ('unknown', 'valid', 'invalid', 'blocked', 'opted_out');

-- CreateEnum
CREATE TYPE "phone_type" AS ENUM ('mobile', 'landline', 'unknown');

-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('draft', 'ready', 'approved', 'launching', 'paused', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "scraper_job_status" AS ENUM ('pending', 'running', 'completed', 'paused', 'failed');

-- CreateEnum
CREATE TYPE "outreach_channel" AS ENUM ('email', 'whatsapp', 'sms');

-- CreateEnum
CREATE TYPE "template_approval_status" AS ENUM ('not_submitted', 'pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "credit_service_status" AS ENUM ('inactive', 'active', 'grace', 'exhausted');

-- CreateEnum
CREATE TYPE "credit_payment_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "credit_usage_type" AS ENUM ('ai_conversation', 'ai_followup', 'template_message');

-- CreateEnum
CREATE TYPE "number_activity_type" AS ENUM ('provisioned', 'reserved', 'assigned', 'message_sent', 'message_received', 'suspended', 'unsuspended', 'released', 'recycled', 'billed');

-- CreateEnum
CREATE TYPE "number_inventory_status" AS ENUM ('available', 'reserved', 'assigned', 'suspended', 'released');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "art_certificate_url" TEXT,
ADD COLUMN     "art_expiry_date" TIMESTAMP(3),
ADD COLUMN     "art_policy_number" TEXT,
ADD COLUMN     "art_provider" TEXT,
ADD COLUMN     "background_check_date" TIMESTAMP(3),
ADD COLUMN     "background_check_provider" TEXT,
ADD COLUMN     "background_check_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "badge_token" TEXT,
ADD COLUMN     "badge_token_expires_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "unclaimed_profiles" (
    "id" TEXT NOT NULL,
    "source" "unclaimed_profile_source" NOT NULL,
    "source_id" TEXT,
    "source_url" TEXT,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "email" TEXT,
    "cuit" TEXT,
    "matricula" TEXT,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "postal_code" TEXT,
    "profession" TEXT,
    "specialty" TEXT,
    "category" TEXT,
    "category_desc" TEXT,
    "license_expiry" TIMESTAMP(3),
    "outreach_status" "outreach_status" NOT NULL DEFAULT 'not_contacted',
    "last_contacted_at" TIMESTAMP(3),
    "contact_attempts" INTEGER NOT NULL DEFAULT 0,
    "email_sent_at" TIMESTAMP(3),
    "email_delivered_at" TIMESTAMP(3),
    "email_opened_at" TIMESTAMP(3),
    "email_clicked_at" TIMESTAMP(3),
    "email_bounced_at" TIMESTAMP(3),
    "email_unsubscribed_at" TIMESTAMP(3),
    "whatsapp_sent_at" TIMESTAMP(3),
    "whatsapp_delivered_at" TIMESTAMP(3),
    "whatsapp_read_at" TIMESTAMP(3),
    "whatsapp_replied_at" TIMESTAMP(3),
    "whatsapp_failed_at" TIMESTAMP(3),
    "whatsapp_failure_reason" TEXT,
    "whatsapp_status" "whatsapp_status" NOT NULL DEFAULT 'unknown',
    "phone_type" "phone_type",
    "whatsapp_id" TEXT,
    "phone_verified_at" TIMESTAMP(3),
    "claim_token" TEXT,
    "claim_token_expiry" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),
    "claimed_by_user_id" TEXT,
    "claimed_org_id" TEXT,
    "data_quality" "data_quality" NOT NULL DEFAULT 'raw',
    "last_verified_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "campaign_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unclaimed_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_jobs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "scraper_job_status" NOT NULL DEFAULT 'pending',
    "total_provinces" INTEGER NOT NULL DEFAULT 0,
    "completed_provinces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "current_province" TEXT,
    "current_page" INTEGER NOT NULL DEFAULT 0,
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "scraper_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_campaigns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "campaign_status" NOT NULL DEFAULT 'draft',
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "channel" "outreach_channel" NOT NULL DEFAULT 'email',
    "template_name" TEXT,
    "template_status" "template_approval_status" NOT NULL DEFAULT 'not_submitted',
    "template_content" TEXT,
    "email_subject" TEXT,
    "email_from_name" TEXT,
    "email_reply_to" TEXT,
    "source" "unclaimed_profile_source",
    "target_province" TEXT,
    "target_profession" TEXT,
    "target_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_count" INTEGER NOT NULL DEFAULT 0,
    "replied_count" INTEGER NOT NULL DEFAULT 0,
    "claimed_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed_count" INTEGER NOT NULL DEFAULT 0,
    "daily_limit" INTEGER NOT NULL DEFAULT 1000,
    "batch_size" INTEGER NOT NULL DEFAULT 50,
    "batch_delay_ms" INTEGER NOT NULL DEFAULT 60000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "launched_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "outreach_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_credits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_credits" INTEGER NOT NULL DEFAULT 0,
    "lifetime_used" INTEGER NOT NULL DEFAULT 0,
    "grace_credits" INTEGER NOT NULL DEFAULT 50,
    "grace_used" INTEGER NOT NULL DEFAULT 0,
    "grace_activated_at" TIMESTAMP(3),
    "grace_ever_activated" BOOLEAN NOT NULL DEFAULT false,
    "grace_forfeited" BOOLEAN NOT NULL DEFAULT false,
    "status" "credit_service_status" NOT NULL DEFAULT 'inactive',
    "status_changed_at" TIMESTAMP(3),
    "low_balance_threshold" INTEGER NOT NULL DEFAULT 50,
    "last_low_balance_alert" TIMESTAMP(3),
    "alert_75_sent_at" TIMESTAMP(3),
    "alert_90_sent_at" TIMESTAMP(3),
    "alert_100_sent_at" TIMESTAMP(3),
    "bsp_phone_number" TEXT,
    "bsp_number_id" TEXT,
    "bsp_waba_id" TEXT,
    "bsp_status" "bsp_provisioning_status" NOT NULL DEFAULT 'not_provisioned',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_purchases" (
    "id" TEXT NOT NULL,
    "credits_account_id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "price_per_credit" DECIMAL(6,4) NOT NULL,
    "package_name" TEXT,
    "bonus_credits" INTEGER NOT NULL DEFAULT 0,
    "status" "credit_payment_status" NOT NULL DEFAULT 'pending',
    "mp_payment_id" TEXT,
    "mp_preference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_usage_logs" (
    "id" TEXT NOT NULL,
    "credits_account_id" TEXT NOT NULL,
    "credits_used" INTEGER NOT NULL,
    "usage_type" "credit_usage_type" NOT NULL,
    "description" TEXT,
    "conversation_id" TEXT,
    "message_id" TEXT,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "was_grace_credit" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_number_inventory" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "phone_number_formatted" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'AR',
    "bsp_number_id" TEXT,
    "bsp_provider" TEXT NOT NULL DEFAULT 'twilio',
    "waba_id" TEXT,
    "status" "number_inventory_status" NOT NULL DEFAULT 'available',
    "assigned_to_org_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "reserved_at" TIMESTAMP(3),
    "reservation_expires_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3),
    "message_count_total" INTEGER NOT NULL DEFAULT 0,
    "message_count_month" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMP(3),
    "monthly_rental_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "purchased_at" TIMESTAMP(3),
    "last_billed_at" TIMESTAMP(3),
    "total_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "released_at" TIMESTAMP(3),
    "release_reason" TEXT,
    "previous_org_id" TEXT,
    "recycle_count" INTEGER NOT NULL DEFAULT 0,
    "cooldown_until" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_number_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_activity_logs" (
    "id" TEXT NOT NULL,
    "number_id" TEXT NOT NULL,
    "activity_type" "number_activity_type" NOT NULL,
    "organization_id" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "number_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_organizations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TECHNICIAN',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,
    "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,

    CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_reports" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "userId" TEXT,
    "organizationId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_incidents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'investigating',
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "services" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "updates" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unclaimed_profiles_claim_token_key" ON "unclaimed_profiles"("claim_token");

-- CreateIndex
CREATE INDEX "unclaimed_profiles_phone_idx" ON "unclaimed_profiles"("phone");

-- CreateIndex
CREATE INDEX "unclaimed_profiles_email_idx" ON "unclaimed_profiles"("email");

-- CreateIndex
CREATE INDEX "unclaimed_profiles_outreach_status_idx" ON "unclaimed_profiles"("outreach_status");

-- CreateIndex
CREATE INDEX "unclaimed_profiles_whatsapp_status_idx" ON "unclaimed_profiles"("whatsapp_status");

-- CreateIndex
CREATE INDEX "unclaimed_profiles_source_province_idx" ON "unclaimed_profiles"("source", "province");

-- CreateIndex
CREATE INDEX "unclaimed_profiles_profession_idx" ON "unclaimed_profiles"("profession");

-- CreateIndex
CREATE INDEX "unclaimed_profiles_claim_token_idx" ON "unclaimed_profiles"("claim_token");

-- CreateIndex
CREATE INDEX "unclaimed_profiles_campaign_id_idx" ON "unclaimed_profiles"("campaign_id");

-- CreateIndex
CREATE INDEX "unclaimed_profiles_created_at_idx" ON "unclaimed_profiles"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "unclaimed_profiles_source_matricula_key" ON "unclaimed_profiles"("source", "matricula");

-- CreateIndex
CREATE INDEX "scraper_jobs_source_idx" ON "scraper_jobs"("source");

-- CreateIndex
CREATE INDEX "scraper_jobs_status_idx" ON "scraper_jobs"("status");

-- CreateIndex
CREATE INDEX "scraper_jobs_started_at_idx" ON "scraper_jobs"("started_at" DESC);

-- CreateIndex
CREATE INDEX "outreach_campaigns_organization_id_idx" ON "outreach_campaigns"("organization_id");

-- CreateIndex
CREATE INDEX "outreach_campaigns_status_idx" ON "outreach_campaigns"("status");

-- CreateIndex
CREATE INDEX "outreach_campaigns_source_idx" ON "outreach_campaigns"("source");

-- CreateIndex
CREATE INDEX "outreach_campaigns_channel_idx" ON "outreach_campaigns"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_credits_organization_id_key" ON "whatsapp_credits"("organization_id");

-- CreateIndex
CREATE INDEX "whatsapp_credits_status_idx" ON "whatsapp_credits"("status");

-- CreateIndex
CREATE INDEX "whatsapp_credits_bsp_status_idx" ON "whatsapp_credits"("bsp_status");

-- CreateIndex
CREATE INDEX "whatsapp_credits_balance_idx" ON "whatsapp_credits"("balance");

-- CreateIndex
CREATE INDEX "credit_purchases_credits_account_id_idx" ON "credit_purchases"("credits_account_id");

-- CreateIndex
CREATE INDEX "credit_purchases_status_idx" ON "credit_purchases"("status");

-- CreateIndex
CREATE INDEX "credit_purchases_created_at_idx" ON "credit_purchases"("created_at");

-- CreateIndex
CREATE INDEX "credit_usage_logs_credits_account_id_idx" ON "credit_usage_logs"("credits_account_id");

-- CreateIndex
CREATE INDEX "credit_usage_logs_usage_type_idx" ON "credit_usage_logs"("usage_type");

-- CreateIndex
CREATE INDEX "credit_usage_logs_used_at_idx" ON "credit_usage_logs"("used_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_number_inventory_phone_number_key" ON "whatsapp_number_inventory"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_number_inventory_assigned_to_org_id_key" ON "whatsapp_number_inventory"("assigned_to_org_id");

-- CreateIndex
CREATE INDEX "whatsapp_number_inventory_status_idx" ON "whatsapp_number_inventory"("status");

-- CreateIndex
CREATE INDEX "whatsapp_number_inventory_bsp_provider_idx" ON "whatsapp_number_inventory"("bsp_provider");

-- CreateIndex
CREATE INDEX "whatsapp_number_inventory_country_code_idx" ON "whatsapp_number_inventory"("country_code");

-- CreateIndex
CREATE INDEX "whatsapp_number_inventory_last_activity_at_idx" ON "whatsapp_number_inventory"("last_activity_at");

-- CreateIndex
CREATE INDEX "whatsapp_number_inventory_status_country_code_idx" ON "whatsapp_number_inventory"("status", "country_code");

-- CreateIndex
CREATE INDEX "number_activity_logs_number_id_idx" ON "number_activity_logs"("number_id");

-- CreateIndex
CREATE INDEX "number_activity_logs_activity_type_idx" ON "number_activity_logs"("activity_type");

-- CreateIndex
CREATE INDEX "number_activity_logs_organization_id_idx" ON "number_activity_logs"("organization_id");

-- CreateIndex
CREATE INDEX "number_activity_logs_created_at_idx" ON "number_activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "user_organizations_userId_idx" ON "user_organizations"("userId");

-- CreateIndex
CREATE INDEX "user_organizations_organizationId_idx" ON "user_organizations"("organizationId");

-- CreateIndex
CREATE INDEX "user_organizations_status_idx" ON "user_organizations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_organizations_userId_organizationId_key" ON "user_organizations"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "support_reports_type_idx" ON "support_reports"("type");

-- CreateIndex
CREATE INDEX "support_reports_status_idx" ON "support_reports"("status");

-- CreateIndex
CREATE INDEX "support_reports_userId_idx" ON "support_reports"("userId");

-- CreateIndex
CREATE INDEX "support_reports_organizationId_idx" ON "support_reports"("organizationId");

-- CreateIndex
CREATE INDEX "support_reports_createdAt_idx" ON "support_reports"("createdAt");

-- CreateIndex
CREATE INDEX "status_incidents_status_idx" ON "status_incidents"("status");

-- CreateIndex
CREATE INDEX "status_incidents_startedAt_idx" ON "status_incidents"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_badge_token_key" ON "users"("badge_token");

-- CreateIndex
CREATE INDEX "users_badge_token_idx" ON "users"("badge_token");

-- CreateIndex
CREATE INDEX "users_art_expiry_date_idx" ON "users"("art_expiry_date");

-- CreateIndex
CREATE INDEX "users_background_check_status_idx" ON "users"("background_check_status");

-- AddForeignKey
ALTER TABLE "unclaimed_profiles" ADD CONSTRAINT "unclaimed_profiles_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "outreach_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_credits" ADD CONSTRAINT "whatsapp_credits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_credits_account_id_fkey" FOREIGN KEY ("credits_account_id") REFERENCES "whatsapp_credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_usage_logs" ADD CONSTRAINT "credit_usage_logs_credits_account_id_fkey" FOREIGN KEY ("credits_account_id") REFERENCES "whatsapp_credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_number_inventory" ADD CONSTRAINT "whatsapp_number_inventory_assigned_to_org_id_fkey" FOREIGN KEY ("assigned_to_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_activity_logs" ADD CONSTRAINT "number_activity_logs_number_id_fkey" FOREIGN KEY ("number_id") REFERENCES "whatsapp_number_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
