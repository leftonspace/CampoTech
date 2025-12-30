/*
  Warnings:

  - The `verification_status` column on the `organizations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `verification_status` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[organization_id,requirement_id,user_id]` on the table `verification_submissions` will be added. If there are existing duplicate values, this will fail.
  - Made the column `grace_period_days` on table `verification_requirements` required. This step will fail if there are existing NULL values in that column.
  - Made the column `display_order` on table `verification_requirements` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "org_verification_status" AS ENUM ('pending', 'partial', 'verified', 'suspended');

-- DropForeignKey
ALTER TABLE "compliance_acknowledgments" DROP CONSTRAINT "compliance_acknowledgments_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "compliance_acknowledgments" DROP CONSTRAINT "compliance_acknowledgments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "compliance_blocks" DROP CONSTRAINT "compliance_blocks_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "compliance_blocks" DROP CONSTRAINT "compliance_blocks_related_submission_id_fkey";

-- DropForeignKey
ALTER TABLE "compliance_blocks" DROP CONSTRAINT "compliance_blocks_user_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_subscriptions" DROP CONSTRAINT "organization_subscriptions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription_events" DROP CONSTRAINT "subscription_events_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription_events" DROP CONSTRAINT "subscription_events_subscription_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription_payments" DROP CONSTRAINT "subscription_payments_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "subscription_payments" DROP CONSTRAINT "subscription_payments_subscription_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_reminders" DROP CONSTRAINT "verification_reminders_recipient_user_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_reminders" DROP CONSTRAINT "verification_reminders_submission_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_submissions" DROP CONSTRAINT "verification_submissions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_submissions" DROP CONSTRAINT "verification_submissions_requirement_id_fkey";

-- DropForeignKey
ALTER TABLE "verification_submissions" DROP CONSTRAINT "verification_submissions_user_id_fkey";

-- AlterTable
ALTER TABLE "compliance_acknowledgments" ALTER COLUMN "acknowledged_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "compliance_blocks" ALTER COLUMN "blocked_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "unblocked_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "job_visits" ADD COLUMN     "visitConfigIndex" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "eventPreferences" JSONB,
ADD COLUMN     "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quietHoursTimezone" TEXT DEFAULT 'America/Argentina/Buenos_Aires',
ALTER COLUMN "quietHoursStart" SET DEFAULT '22:00',
ALTER COLUMN "quietHoursEnd" SET DEFAULT '08:00';

-- AlterTable
ALTER TABLE "organization_subscriptions" ALTER COLUMN "tier" SET DEFAULT 'FREE',
ALTER COLUMN "trial_ends_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "current_period_start" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "current_period_end" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "cancelled_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "grace_period_ends_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "trial_ends_at" SET DATA TYPE TIMESTAMP(3),
DROP COLUMN "verification_status",
ADD COLUMN     "verification_status" "org_verification_status" NOT NULL DEFAULT 'pending',
ALTER COLUMN "verification_completed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_compliance_check" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscription_events" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscription_payments" ALTER COLUMN "period_start" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "period_end" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "next_retry_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "paid_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "verification_status",
ADD COLUMN     "verification_status" "user_verification_status" NOT NULL DEFAULT 'pending',
ALTER COLUMN "verification_completed_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verification_reminders" ALTER COLUMN "sent_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "read_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "clicked_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verification_requirements" ALTER COLUMN "grace_period_days" SET NOT NULL,
ALTER COLUMN "display_order" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verification_submissions" ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "expiry_notified_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "auto_verify_checked_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "submitted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "wa_messages" ADD COLUMN     "aiActionMetadata" JSONB,
ADD COLUMN     "aiActionTaken" TEXT,
ADD COLUMN     "aiConfidence" INTEGER,
ADD COLUMN     "isProactiveSuggestion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "senderType" TEXT;

-- CreateIndex
CREATE INDEX "compliance_blocks_user_id_idx" ON "compliance_blocks"("user_id");

-- CreateIndex
CREATE INDEX "compliance_blocks_organization_id_user_id_idx" ON "compliance_blocks"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE INDEX "invoices_customerId_status_idx" ON "invoices"("customerId", "status");

-- CreateIndex
CREATE INDEX "job_visits_visitConfigIndex_idx" ON "job_visits"("visitConfigIndex");

-- CreateIndex
CREATE INDEX "jobs_status_completedAt_idx" ON "jobs"("status", "completedAt");

-- CreateIndex
CREATE INDEX "organization_subscriptions_mp_subscription_id_idx" ON "organization_subscriptions"("mp_subscription_id");

-- CreateIndex
CREATE INDEX "organization_subscriptions_trial_ends_at_idx" ON "organization_subscriptions"("trial_ends_at");

-- CreateIndex
CREATE INDEX "organization_subscriptions_grace_period_ends_at_idx" ON "organization_subscriptions"("grace_period_ends_at");

-- CreateIndex
CREATE INDEX "organizations_trial_ends_at_idx" ON "organizations"("trial_ends_at");

-- CreateIndex
CREATE INDEX "organizations_marketplace_visible_idx" ON "organizations"("marketplace_visible");

-- CreateIndex
CREATE INDEX "organizations_verification_status_idx" ON "organizations"("verification_status");

-- CreateIndex
CREATE INDEX "organizations_can_receive_jobs_idx" ON "organizations"("can_receive_jobs");

-- CreateIndex
CREATE INDEX "reviews_customerId_idx" ON "reviews"("customerId");

-- CreateIndex
CREATE INDEX "subscription_events_subscription_id_idx" ON "subscription_events"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_payments_mp_payment_id_idx" ON "subscription_payments"("mp_payment_id");

-- CreateIndex
CREATE INDEX "subscription_payments_next_retry_at_idx" ON "subscription_payments"("next_retry_at");

-- CreateIndex
CREATE INDEX "subscription_payments_paid_at_idx" ON "subscription_payments"("paid_at");

-- CreateIndex
CREATE INDEX "users_verification_status_idx" ON "users"("verification_status");

-- CreateIndex
CREATE INDEX "users_can_be_assigned_jobs_idx" ON "users"("can_be_assigned_jobs");

-- CreateIndex
CREATE INDEX "users_identity_verified_idx" ON "users"("identity_verified");

-- CreateIndex
CREATE INDEX "users_organizationId_role_idx" ON "users"("organizationId", "role");

-- CreateIndex
CREATE INDEX "verification_requirements_is_active_idx" ON "verification_requirements"("is_active");

-- CreateIndex
CREATE INDEX "verification_submissions_user_id_idx" ON "verification_submissions"("user_id");

-- CreateIndex
CREATE INDEX "verification_submissions_expires_at_idx" ON "verification_submissions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "verification_submissions_organization_id_requirement_id_use_key" ON "verification_submissions"("organization_id", "requirement_id", "user_id");

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organization_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_submissions" ADD CONSTRAINT "verification_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_submissions" ADD CONSTRAINT "verification_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_submissions" ADD CONSTRAINT "verification_submissions_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "verification_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reminders" ADD CONSTRAINT "verification_reminders_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "verification_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reminders" ADD CONSTRAINT "verification_reminders_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_acknowledgments" ADD CONSTRAINT "compliance_acknowledgments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_acknowledgments" ADD CONSTRAINT "compliance_acknowledgments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_blocks" ADD CONSTRAINT "compliance_blocks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_blocks" ADD CONSTRAINT "compliance_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_blocks" ADD CONSTRAINT "compliance_blocks_related_submission_id_fkey" FOREIGN KEY ("related_submission_id") REFERENCES "verification_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX IF EXISTS "idx_compliance_acknowledgments_org" RENAME TO "compliance_acknowledgments_organization_id_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_compliance_acknowledgments_type" RENAME TO "compliance_acknowledgments_acknowledgment_type_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_compliance_acknowledgments_unique" RENAME TO "compliance_acknowledgments_user_id_acknowledgment_type_vers_key";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_compliance_acknowledgments_user" RENAME TO "compliance_acknowledgments_user_id_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_compliance_blocks_org" RENAME TO "compliance_blocks_organization_id_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_compliance_blocks_type" RENAME TO "compliance_blocks_block_type_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_org_subscriptions_period_end" RENAME TO "organization_subscriptions_current_period_end_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_org_subscriptions_status" RENAME TO "organization_subscriptions_status_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "org_subscriptions_org_id_unique" RENAME TO "organization_subscriptions_organization_id_key";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_organizations_last_compliance_check" RENAME TO "organizations_last_compliance_check_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_organizations_subscription_status" RENAME TO "organizations_subscription_status_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_organizations_subscription_tier" RENAME TO "organizations_subscription_tier_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_subscription_events_created_at" RENAME TO "subscription_events_created_at_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_subscription_events_event_type" RENAME TO "subscription_events_event_type_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_subscription_events_org_created" RENAME TO "subscription_events_organization_id_created_at_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_subscription_events_organization_id" RENAME TO "subscription_events_organization_id_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_subscription_payments_created_at" RENAME TO "subscription_payments_created_at_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_subscription_payments_organization_id" RENAME TO "subscription_payments_organization_id_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_subscription_payments_status" RENAME TO "subscription_payments_status_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_subscription_payments_subscription_id" RENAME TO "subscription_payments_subscription_id_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_users_verification_status" RENAME TO "users_verification_status_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_verification_reminders_dedup" RENAME TO "verification_reminders_submission_id_reminder_type_days_unt_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_verification_reminders_recipient" RENAME TO "verification_reminders_recipient_user_id_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_verification_reminders_sent" RENAME TO "verification_reminders_sent_at_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_verification_reminders_submission" RENAME TO "verification_reminders_submission_id_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_verification_requirements_applies_to" RENAME TO "verification_requirements_applies_to_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_verification_requirements_display_order" RENAME TO "verification_requirements_display_order_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_verification_requirements_tier" RENAME TO "verification_requirements_tier_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_verification_submissions_org" RENAME TO "verification_submissions_organization_id_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_verification_submissions_requirement" RENAME TO "verification_submissions_requirement_id_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "idx_verification_submissions_status" RENAME TO "verification_submissions_status_idx";
