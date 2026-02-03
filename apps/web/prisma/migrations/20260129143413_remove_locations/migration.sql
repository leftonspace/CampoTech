/*
  Warnings:

  - You are about to drop the column `locationId` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `zoneId` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `locationId` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `locationId` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `zoneId` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `homeLocationId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `locationId` on the `warehouses` table. All the data in the column will be lost.
  - You are about to drop the `inter_location_transfers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `location_afip_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `location_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `locations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `zones` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "uocra_level" AS ENUM ('OFICIAL', 'MEDIO_OFICIAL', 'AYUDANTE', 'NONE');

-- CreateEnum
CREATE TYPE "support_status" AS ENUM ('open', 'pending_response', 'responded', 'new_reply', 'closed');

-- CreateEnum
CREATE TYPE "pricing_model" AS ENUM ('FIXED', 'HOURLY', 'PER_UNIT', 'PER_M2', 'PER_DAY', 'QUOTE');

-- CreateEnum
CREATE TYPE "line_item_source" AS ENUM ('QUOTE', 'TECH_ADDED', 'TECH_ADJUSTED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "invoice_generation_mode" AS ENUM ('MANUAL', 'AUTO_ON_COMPLETION', 'AUTO_ON_APPROVAL');

-- CreateEnum
CREATE TYPE "job_pricing_mode" AS ENUM ('FIXED_TOTAL', 'PER_VISIT', 'HYBRID');

-- CreateEnum
CREATE TYPE "exchange_rate_source" AS ENUM ('OFICIAL', 'BLUE', 'MEP', 'CCL', 'CRYPTO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "rounding_strategy" AS ENUM ('ROUND_100', 'ROUND_500', 'ROUND_1000', 'ROUND_5000', 'NO_ROUNDING');

-- CreateEnum
CREATE TYPE "rounding_direction" AS ENUM ('NEAREST', 'UP', 'DOWN');

-- CreateEnum
CREATE TYPE "inflation_index_source" AS ENUM ('CAC_ICC_GENERAL', 'CAC_ICC_MATERIALS', 'CAC_ICC_LABOR', 'INDEC_IPC_GENERAL', 'INDEC_IPC_HOUSING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "price_change_reason" AS ENUM ('MANUAL', 'INFLATION_AUTO', 'INFLATION_MANUAL', 'EXCHANGE_RATE', 'INITIAL');

-- CreateEnum
CREATE TYPE "adjustment_type" AS ENUM ('ALL', 'SERVICES', 'PRODUCTS', 'SPECIALTY');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'IN_PROGRESS', 'READY', 'DOWNLOADED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('ACCESS', 'RECTIFICATION', 'CANCELLATION', 'OPPOSITION');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_locationId_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "inter_location_transfers" DROP CONSTRAINT "inter_location_transfers_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "inter_location_transfers" DROP CONSTRAINT "inter_location_transfers_fromLocationId_fkey";

-- DropForeignKey
ALTER TABLE "inter_location_transfers" DROP CONSTRAINT "inter_location_transfers_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "inter_location_transfers" DROP CONSTRAINT "inter_location_transfers_toLocationId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_locationId_fkey";

-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_locationId_fkey";

-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_zoneId_fkey";

-- DropForeignKey
ALTER TABLE "location_afip_configs" DROP CONSTRAINT "location_afip_configs_locationId_fkey";

-- DropForeignKey
ALTER TABLE "location_settings" DROP CONSTRAINT "location_settings_locationId_fkey";

-- DropForeignKey
ALTER TABLE "locations" DROP CONSTRAINT "locations_managerId_fkey";

-- DropForeignKey
ALTER TABLE "locations" DROP CONSTRAINT "locations_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_homeLocationId_fkey";

-- DropForeignKey
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_locationId_fkey";

-- DropForeignKey
ALTER TABLE "zones" DROP CONSTRAINT "zones_locationId_fkey";

-- DropIndex
DROP INDEX "customers_locationId_idx";

-- DropIndex
DROP INDEX "customers_zoneId_idx";

-- DropIndex
DROP INDEX "invoices_locationId_idx";

-- DropIndex
DROP INDEX "jobs_locationId_idx";

-- DropIndex
DROP INDEX "jobs_zoneId_idx";

-- DropIndex
DROP INDEX "schedule_exceptions_userId_date_key";

-- DropIndex
DROP INDEX "users_homeLocationId_idx";

-- DropIndex
DROP INDEX "warehouses_locationId_idx";

-- AlterTable
ALTER TABLE "ai_configurations" ADD COLUMN     "workflowPermissions" JSONB NOT NULL DEFAULT '{"suggestResponses": true, "translateMessages": true, "suggestActions": true, "accessDatabase": true, "accessSchedule": true, "autoApproveSmallPriceAdjustments": false, "autoApproveThresholdPercent": 5, "autoAssignTechnicians": false}';

-- AlterTable
ALTER TABLE "ai_conversation_logs" ADD COLUMN     "feedback_type" TEXT,
ADD COLUMN     "modified_content" TEXT,
ADD COLUMN     "user_modified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "locationId",
DROP COLUMN "zoneId";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "locationId";

-- AlterTable
ALTER TABLE "job_visits" ADD COLUMN     "actual_price" DECIMAL(12,2),
ADD COLUMN     "deposit_amount" DECIMAL(12,2),
ADD COLUMN     "deposit_paid_at" TIMESTAMP(3),
ADD COLUMN     "estimated_price" DECIMAL(12,2),
ADD COLUMN     "price_variance_reason" TEXT,
ADD COLUMN     "requires_deposit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tech_proposed_price" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "locationId",
DROP COLUMN "zoneId",
ADD COLUMN     "default_visit_rate" DECIMAL(12,2),
ADD COLUMN     "deposit_amount" DECIMAL(12,2),
ADD COLUMN     "deposit_paid_at" TIMESTAMP(3),
ADD COLUMN     "deposit_payment_method" TEXT,
ADD COLUMN     "driver_license_at_job" TEXT,
ADD COLUMN     "driver_name_at_job" TEXT,
ADD COLUMN     "estimated_total" DECIMAL(12,2),
ADD COLUMN     "final_total" DECIMAL(12,2),
ADD COLUMN     "pricing_locked_at" TIMESTAMP(3),
ADD COLUMN     "pricing_locked_by_id" TEXT,
ADD COLUMN     "pricing_mode" "job_pricing_mode" NOT NULL DEFAULT 'FIXED_TOTAL',
ADD COLUMN     "service_type_code" TEXT,
ADD COLUMN     "tech_proposed_total" DECIMAL(12,2),
ADD COLUMN     "variance_approved_at" TIMESTAMP(3),
ADD COLUMN     "variance_approved_by_id" TEXT,
ADD COLUMN     "variance_rejected_at" TIMESTAMP(3),
ADD COLUMN     "variance_rejected_by_id" TEXT,
ADD COLUMN     "vehicleId" TEXT,
ADD COLUMN     "vehicle_mileage_end" INTEGER,
ADD COLUMN     "vehicle_mileage_start" INTEGER,
ADD COLUMN     "vehicle_plate_at_job" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "languages_spoken" TEXT[] DEFAULT ARRAY['es']::TEXT[],
ADD COLUMN     "translation_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_templates" JSONB;

-- AlterTable
ALTER TABLE "price_items" ADD COLUMN     "auto_inflation_adjust" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "exchange_rate_at_set" DECIMAL(12,4),
ADD COLUMN     "last_adjusted_at" TIMESTAMP(3),
ADD COLUMN     "original_price" DECIMAL(12,2),
ADD COLUMN     "price_currency" TEXT NOT NULL DEFAULT 'ARS',
ADD COLUMN     "price_in_usd" DECIMAL(12,2),
ADD COLUMN     "pricingModel" "pricing_model",
ADD COLUMN     "specialty" TEXT;

-- AlterTable
ALTER TABLE "service_type_configs" ADD COLUMN     "specialty" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "homeLocationId",
ADD COLUMN     "advance_notice_hours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "driver_license_category" TEXT,
ADD COLUMN     "driver_license_expiry" TIMESTAMP(3),
ADD COLUMN     "driver_license_number" TEXT,
ADD COLUMN     "hourly_rate_override" DECIMAL(12,2),
ADD COLUMN     "schedule_type" TEXT NOT NULL DEFAULT 'base',
ADD COLUMN     "uocra_level" "uocra_level" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "wa_conversations" ADD COLUMN     "session_language" TEXT;

-- AlterTable
ALTER TABLE "wa_messages" ADD COLUMN     "ai_feedback" TEXT,
ADD COLUMN     "ai_feedback_at" TIMESTAMP(3),
ADD COLUMN     "ai_feedback_user_id" TEXT,
ADD COLUMN     "detected_language" TEXT,
ADD COLUMN     "language_confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "original_content" TEXT,
ADD COLUMN     "translated_content" TEXT;

-- AlterTable
ALTER TABLE "warehouses" DROP COLUMN "locationId";

-- DropTable
DROP TABLE "inter_location_transfers";

-- DropTable
DROP TABLE "location_afip_configs";

-- DropTable
DROP TABLE "location_settings";

-- DropTable
DROP TABLE "locations";

-- DropTable
DROP TABLE "zones";

-- DropEnum
DROP TYPE "LocationType";

-- DropEnum
DROP TYPE "TransferStatus";

-- DropEnum
DROP TYPE "TransferType";

-- CreateTable
CREATE TABLE "job_visit_vehicles" (
    "id" TEXT NOT NULL,
    "jobVisitId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicle_plate_snapshot" TEXT,
    "vehicle_make_snapshot" TEXT,
    "vehicle_model_snapshot" TEXT,

    CONSTRAINT "job_visit_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_visit_vehicle_drivers" (
    "id" TEXT NOT NULL,
    "jobVisitVehicleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "driver_name_snapshot" TEXT,
    "driver_license_snapshot" TEXT,

    CONSTRAINT "job_visit_vehicle_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_item_relations" (
    "id" TEXT NOT NULL,
    "source_item_id" TEXT NOT NULL,
    "related_item_id" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "price_item_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_line_items" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "price_item_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 21.0,
    "taxAmount" DECIMAL(12,2),
    "source" "line_item_source" NOT NULL DEFAULT 'QUOTE',
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "job_visit_id" TEXT,

    CONSTRAINT "job_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_pricing_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tech_can_modify_pricing" BOOLEAN NOT NULL DEFAULT true,
    "tech_max_adjustment_percent" DECIMAL(5,2),
    "tech_max_adjustment_amount" DECIMAL(12,2),
    "require_approval_over_limit" BOOLEAN NOT NULL DEFAULT true,
    "invoice_generation" "invoice_generation_mode" NOT NULL DEFAULT 'MANUAL',
    "auto_lock_on_invoice" BOOLEAN NOT NULL DEFAULT true,
    "enable_deposits" BOOLEAN NOT NULL DEFAULT true,
    "default_deposit_percent" DECIMAL(5,2),
    "require_deposit_to_start" BOOLEAN NOT NULL DEFAULT false,
    "use_price_book" BOOLEAN NOT NULL DEFAULT true,
    "price_book_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "default_currency" TEXT NOT NULL DEFAULT 'ARS',
    "exchange_rate_source" "exchange_rate_source" NOT NULL DEFAULT 'BLUE',
    "custom_exchange_rate" DECIMAL(12,4),
    "exchange_rate_markup" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "exchange_rate_label" TEXT,
    "auto_update_exchange_rate" BOOLEAN NOT NULL DEFAULT true,
    "rounding_strategy" "rounding_strategy" NOT NULL DEFAULT 'ROUND_500',
    "rounding_direction" "rounding_direction" NOT NULL DEFAULT 'NEAREST',
    "auto_update_threshold" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "anchor_exchange_rate" DECIMAL(12,4),
    "anchor_set_at" TIMESTAMP(3),
    "inflation_index_source" "inflation_index_source",
    "auto_inflation_adjust" BOOLEAN NOT NULL DEFAULT false,
    "inflation_extra_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "last_inflation_check" TIMESTAMP(3),
    "uocra_oficial_rate" DECIMAL(12,2),
    "uocra_medio_oficial_rate" DECIMAL(12,2),
    "uocra_ayudante_rate" DECIMAL(12,2),
    "uocra_rates_updated_at" TIMESTAMP(3),
    "uocra_reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pricing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_labor_rates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hourly_rate" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_labor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_support_conversations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "visitor_name" TEXT,
    "visitor_email" TEXT,
    "visitor_phone" TEXT,
    "ticket_number" TEXT NOT NULL,
    "status" "support_status" NOT NULL DEFAULT 'open',
    "category" TEXT,
    "ai_disabled" BOOLEAN NOT NULL DEFAULT false,
    "escalated_at" TIMESTAMP(3),
    "push_subscription" TEXT,
    "page_url" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "public_support_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_support_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "responded_by" TEXT,
    "notified_via" TEXT[],
    "notified_at" TIMESTAMP(3),
    "read_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "read_by_visitor" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "export_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_name" TEXT,
    "options" JSONB NOT NULL DEFAULT '{}',
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "delivery_method" TEXT NOT NULL DEFAULT 'download',
    "delivery_email" TEXT,
    "file_url" TEXT,
    "file_size" INTEGER,
    "file_name" TEXT,
    "download_token" TEXT,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "max_downloads" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3),
    "requested_by_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_access_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "request_type" "DataRequestType" NOT NULL DEFAULT 'ACCESS',
    "requester_name" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "requester_phone" TEXT,
    "requester_dni" TEXT,
    "customer_id" TEXT,
    "verification_code" TEXT,
    "verification_sent_at" TIMESTAMP(3),
    "verification_attempts" INTEGER NOT NULL DEFAULT 0,
    "verified_at" TIMESTAMP(3),
    "request_reason" TEXT,
    "data_scope" TEXT[],
    "status" "DataRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "status_history" JSONB NOT NULL DEFAULT '[]',
    "assigned_to_id" TEXT,
    "internal_notes" TEXT,
    "download_token" TEXT,
    "download_url" TEXT,
    "expires_at" TIMESTAMP(3),
    "downloaded_at" TIMESTAMP(3),
    "legal_deadline" TIMESTAMP(3),
    "response_date" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_request_audit_logs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "performed_by" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_request_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_registry" (
    "id" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "full_name" TEXT,
    "province" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_verified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "source" "exchange_rate_source" NOT NULL,
    "buy_rate" DECIMAL(12,4) NOT NULL,
    "sell_rate" DECIMAL(12,4) NOT NULL,
    "average_rate" DECIMAL(12,4) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_item_history" (
    "id" TEXT NOT NULL,
    "price_item_id" TEXT NOT NULL,
    "previous_price" DECIMAL(12,2) NOT NULL,
    "new_price" DECIMAL(12,2) NOT NULL,
    "change_reason" "price_change_reason" NOT NULL,
    "change_percent" DECIMAL(5,2) NOT NULL,
    "index_source" TEXT,
    "index_period" TEXT,
    "index_rate" DECIMAL(6,3),
    "exchange_rate" DECIMAL(12,4),
    "changed_by_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "price_item_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inflation_indices" (
    "id" TEXT NOT NULL,
    "source" "inflation_index_source" NOT NULL,
    "period" TEXT NOT NULL,
    "rate" DECIMAL(6,3) NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inflation_indices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_schedules" (
    "id" TEXT NOT NULL,
    "source" "inflation_index_source" NOT NULL,
    "last_scraped_at" TIMESTAMP(3),
    "last_scraped_period" TEXT,
    "next_report_date" TIMESTAMP(3),
    "scrape_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "is_waiting_for_update" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrape_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_adjustment_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "index_source" "inflation_index_source" NOT NULL,
    "index_period" TEXT NOT NULL,
    "index_rate" DECIMAL(6,3) NOT NULL,
    "extra_percent" DECIMAL(5,2) NOT NULL,
    "total_adjustment" DECIMAL(6,3) NOT NULL,
    "adjustment_type" "adjustment_type" NOT NULL,
    "specialty_filter" TEXT,
    "items_affected" INTEGER NOT NULL,
    "total_value_before" DECIMAL(14,2) NOT NULL,
    "total_value_after" DECIMAL(14,2) NOT NULL,
    "applied_by_id" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "price_adjustment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_visit_vehicles_jobVisitId_idx" ON "job_visit_vehicles"("jobVisitId");

-- CreateIndex
CREATE INDEX "job_visit_vehicles_vehicleId_idx" ON "job_visit_vehicles"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "job_visit_vehicles_jobVisitId_vehicleId_key" ON "job_visit_vehicles"("jobVisitId", "vehicleId");

-- CreateIndex
CREATE INDEX "job_visit_vehicle_drivers_jobVisitVehicleId_idx" ON "job_visit_vehicle_drivers"("jobVisitVehicleId");

-- CreateIndex
CREATE INDEX "job_visit_vehicle_drivers_userId_idx" ON "job_visit_vehicle_drivers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "job_visit_vehicle_drivers_jobVisitVehicleId_userId_key" ON "job_visit_vehicle_drivers"("jobVisitVehicleId", "userId");

-- CreateIndex
CREATE INDEX "price_item_relations_source_item_id_idx" ON "price_item_relations"("source_item_id");

-- CreateIndex
CREATE INDEX "price_item_relations_related_item_id_idx" ON "price_item_relations"("related_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_item_relations_source_item_id_related_item_id_key" ON "price_item_relations"("source_item_id", "related_item_id");

-- CreateIndex
CREATE INDEX "job_line_items_job_id_idx" ON "job_line_items"("job_id");

-- CreateIndex
CREATE INDEX "job_line_items_price_item_id_idx" ON "job_line_items"("price_item_id");

-- CreateIndex
CREATE INDEX "job_line_items_created_by_id_idx" ON "job_line_items"("created_by_id");

-- CreateIndex
CREATE INDEX "job_line_items_source_idx" ON "job_line_items"("source");

-- CreateIndex
CREATE INDEX "job_line_items_job_visit_id_idx" ON "job_line_items"("job_visit_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_pricing_settings_organization_id_key" ON "organization_pricing_settings"("organization_id");

-- CreateIndex
CREATE INDEX "organization_labor_rates_organization_id_idx" ON "organization_labor_rates"("organization_id");

-- CreateIndex
CREATE INDEX "organization_labor_rates_specialty_idx" ON "organization_labor_rates"("specialty");

-- CreateIndex
CREATE UNIQUE INDEX "organization_labor_rates_organization_id_specialty_category_key" ON "organization_labor_rates"("organization_id", "specialty", "category");

-- CreateIndex
CREATE UNIQUE INDEX "public_support_conversations_session_id_key" ON "public_support_conversations"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_support_conversations_ticket_number_key" ON "public_support_conversations"("ticket_number");

-- CreateIndex
CREATE INDEX "public_support_conversations_session_id_idx" ON "public_support_conversations"("session_id");

-- CreateIndex
CREATE INDEX "public_support_conversations_status_idx" ON "public_support_conversations"("status");

-- CreateIndex
CREATE INDEX "public_support_conversations_ticket_number_idx" ON "public_support_conversations"("ticket_number");

-- CreateIndex
CREATE INDEX "public_support_conversations_last_activity_at_idx" ON "public_support_conversations"("last_activity_at");

-- CreateIndex
CREATE INDEX "public_support_conversations_created_at_idx" ON "public_support_conversations"("created_at");

-- CreateIndex
CREATE INDEX "public_support_messages_conversation_id_idx" ON "public_support_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "public_support_messages_role_idx" ON "public_support_messages"("role");

-- CreateIndex
CREATE INDEX "public_support_messages_created_at_idx" ON "public_support_messages"("created_at");

-- CreateIndex
CREATE INDEX "public_support_messages_conversation_id_created_at_idx" ON "public_support_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "export_requests_download_token_key" ON "export_requests"("download_token");

-- CreateIndex
CREATE INDEX "export_requests_organization_id_idx" ON "export_requests"("organization_id");

-- CreateIndex
CREATE INDEX "export_requests_status_idx" ON "export_requests"("status");

-- CreateIndex
CREATE INDEX "export_requests_download_token_idx" ON "export_requests"("download_token");

-- CreateIndex
CREATE INDEX "export_requests_expires_at_idx" ON "export_requests"("expires_at");

-- CreateIndex
CREATE INDEX "export_requests_created_at_idx" ON "export_requests"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "data_access_requests_download_token_key" ON "data_access_requests"("download_token");

-- CreateIndex
CREATE INDEX "data_access_requests_organization_id_idx" ON "data_access_requests"("organization_id");

-- CreateIndex
CREATE INDEX "data_access_requests_status_idx" ON "data_access_requests"("status");

-- CreateIndex
CREATE INDEX "data_access_requests_requester_email_idx" ON "data_access_requests"("requester_email");

-- CreateIndex
CREATE INDEX "data_access_requests_download_token_idx" ON "data_access_requests"("download_token");

-- CreateIndex
CREATE INDEX "data_access_requests_created_at_idx" ON "data_access_requests"("created_at");

-- CreateIndex
CREATE INDEX "data_access_requests_legal_deadline_idx" ON "data_access_requests"("legal_deadline");

-- CreateIndex
CREATE INDEX "data_request_audit_logs_request_id_idx" ON "data_request_audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "data_request_audit_logs_action_idx" ON "data_request_audit_logs"("action");

-- CreateIndex
CREATE INDEX "data_request_audit_logs_created_at_idx" ON "data_request_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "verification_registry_matricula_idx" ON "verification_registry"("matricula");

-- CreateIndex
CREATE INDEX "verification_registry_specialty_idx" ON "verification_registry"("specialty");

-- CreateIndex
CREATE INDEX "verification_registry_source_idx" ON "verification_registry"("source");

-- CreateIndex
CREATE INDEX "verification_registry_status_idx" ON "verification_registry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "verification_registry_matricula_source_key" ON "verification_registry"("matricula", "source");

-- CreateIndex
CREATE INDEX "exchange_rates_source_fetched_at_idx" ON "exchange_rates"("source", "fetched_at");

-- CreateIndex
CREATE INDEX "exchange_rates_valid_until_idx" ON "exchange_rates"("valid_until");

-- CreateIndex
CREATE INDEX "price_item_history_price_item_id_changed_at_idx" ON "price_item_history"("price_item_id", "changed_at");

-- CreateIndex
CREATE INDEX "price_item_history_changed_by_id_idx" ON "price_item_history"("changed_by_id");

-- CreateIndex
CREATE INDEX "price_item_history_change_reason_idx" ON "price_item_history"("change_reason");

-- CreateIndex
CREATE INDEX "inflation_indices_source_period_idx" ON "inflation_indices"("source", "period");

-- CreateIndex
CREATE INDEX "inflation_indices_published_at_idx" ON "inflation_indices"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "inflation_indices_source_period_key" ON "inflation_indices"("source", "period");

-- CreateIndex
CREATE UNIQUE INDEX "scrape_schedules_source_key" ON "scrape_schedules"("source");

-- CreateIndex
CREATE INDEX "price_adjustment_events_organization_id_applied_at_idx" ON "price_adjustment_events"("organization_id", "applied_at");

-- CreateIndex
CREATE INDEX "price_adjustment_events_applied_by_id_idx" ON "price_adjustment_events"("applied_by_id");

-- CreateIndex
CREATE INDEX "job_visits_estimated_price_idx" ON "job_visits"("estimated_price");

-- CreateIndex
CREATE INDEX "jobs_vehicleId_idx" ON "jobs"("vehicleId");

-- CreateIndex
CREATE INDEX "price_items_specialty_idx" ON "price_items"("specialty");

-- CreateIndex
CREATE INDEX "price_items_price_currency_idx" ON "price_items"("price_currency");

-- CreateIndex
CREATE INDEX "schedule_exceptions_userId_date_idx" ON "schedule_exceptions"("userId", "date");

-- CreateIndex
CREATE INDEX "service_type_configs_specialty_idx" ON "service_type_configs"("specialty");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_visit_vehicles" ADD CONSTRAINT "job_visit_vehicles_jobVisitId_fkey" FOREIGN KEY ("jobVisitId") REFERENCES "job_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_visit_vehicles" ADD CONSTRAINT "job_visit_vehicles_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_visit_vehicle_drivers" ADD CONSTRAINT "job_visit_vehicle_drivers_jobVisitVehicleId_fkey" FOREIGN KEY ("jobVisitVehicleId") REFERENCES "job_visit_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_visit_vehicle_drivers" ADD CONSTRAINT "job_visit_vehicle_drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_item_relations" ADD CONSTRAINT "price_item_relations_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "price_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_item_relations" ADD CONSTRAINT "price_item_relations_related_item_id_fkey" FOREIGN KEY ("related_item_id") REFERENCES "price_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_item_relations" ADD CONSTRAINT "price_item_relations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_price_item_id_fkey" FOREIGN KEY ("price_item_id") REFERENCES "price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_job_visit_id_fkey" FOREIGN KEY ("job_visit_id") REFERENCES "job_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_pricing_settings" ADD CONSTRAINT "organization_pricing_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_labor_rates" ADD CONSTRAINT "organization_labor_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_support_messages" ADD CONSTRAINT "public_support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public_support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_requests" ADD CONSTRAINT "data_access_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_requests" ADD CONSTRAINT "data_access_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_requests" ADD CONSTRAINT "data_access_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_request_audit_logs" ADD CONSTRAINT "data_request_audit_logs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "data_access_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_item_history" ADD CONSTRAINT "price_item_history_price_item_id_fkey" FOREIGN KEY ("price_item_id") REFERENCES "price_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_item_history" ADD CONSTRAINT "price_item_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_adjustment_events" ADD CONSTRAINT "price_adjustment_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_adjustment_events" ADD CONSTRAINT "price_adjustment_events_applied_by_id_fkey" FOREIGN KEY ("applied_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
