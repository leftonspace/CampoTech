/*
  Warnings:

  - A unique constraint covering the columns `[vehicleId]` on the table `warehouses` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PriceItemType" AS ENUM ('SERVICE', 'PRODUCT');

-- CreateEnum
CREATE TYPE "WaAccountStatus" AS ENUM ('PENDING', 'VERIFYING', 'ACTIVE', 'SUSPENDED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "WaConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED', 'SPAM');

-- CreateEnum
CREATE TYPE "WaTemplateCategory" AS ENUM ('UTILITY', 'MARKETING', 'AUTHENTICATION');

-- CreateEnum
CREATE TYPE "WaTemplateStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WaTemplateHeaderType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION');

-- CreateEnum
CREATE TYPE "WaQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ACCOUNTANT';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "whatsappAccessToken" TEXT,
ADD COLUMN     "whatsappAppSecret" TEXT,
ADD COLUMN     "whatsappBusinessAccountId" TEXT,
ADD COLUMN     "whatsappPhoneNumberId" TEXT,
ADD COLUMN     "whatsappWebhookVerifyToken" TEXT;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "vehicleId" TEXT;

-- CreateTable
CREATE TABLE "service_type_configs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_assignments" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PriceItemType" NOT NULL DEFAULT 'SERVICE',
    "price" DECIMAL(12,2) NOT NULL,
    "unit" TEXT,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 21.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_business_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "businessAccountId" TEXT,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "webhookVerifyToken" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "status" "WaAccountStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "displayPhoneNumber" TEXT,
    "businessName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_business_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_conversations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT,
    "customerId" TEXT,
    "status" "WaConversationStatus" NOT NULL DEFAULT 'OPEN',
    "isUnread" BOOLEAN NOT NULL DEFAULT true,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" TEXT,
    "lastMessageDirection" TEXT,
    "lastMessageStatus" TEXT,
    "windowExpiresAt" TIMESTAMP(3),
    "canSendFreeform" BOOLEAN NOT NULL DEFAULT false,
    "assignedToId" TEXT,
    "activeJobId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wa_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "customerId" TEXT,
    "waMessageId" TEXT,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaId" TEXT,
    "mediaUrl" TEXT,
    "mediaMimeType" TEXT,
    "mediaFilename" TEXT,
    "templateName" TEXT,
    "templateParams" JSONB,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusUpdatedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentById" TEXT,
    "replyToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "waTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es_AR',
    "category" "WaTemplateCategory" NOT NULL DEFAULT 'UTILITY',
    "components" JSONB NOT NULL,
    "headerType" TEXT,
    "headerContent" TEXT,
    "bodyText" TEXT,
    "footerText" TEXT,
    "buttons" JSONB,
    "status" "WaTemplateStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wa_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_outbound_queue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageId" TEXT,
    "to" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WaQueueStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "waMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "wa_outbound_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_webhook_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "webEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderIntervals" JSONB,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_location_history" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "lat" DECIMAL(10,8) NOT NULL,
    "lng" DECIMAL(11,8) NOT NULL,
    "speed" DECIMAL(6,2),
    "heading" DECIMAL(5,2),
    "accuracy" DECIMAL(6,2),
    "movementMode" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_location_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data" JSONB,
    "severity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerifiedAt" TIMESTAMP(3),
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "termsAcceptedAt" TIMESTAMP(3),
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "profileCompletedAt" TIMESTAMP(3),
    "tutorialCompleted" BOOLEAN NOT NULL DEFAULT false,
    "tutorialCompletedAt" TIMESTAMP(3),
    "tutorialSkipped" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panic_modes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integration" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoResolveAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panic_modes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fallback_payments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "reason" TEXT NOT NULL,
    "originalError" TEXT,
    "suggestedMethod" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedMethod" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fallback_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "cooldownUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chargebacks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "mpChargebackId" TEXT NOT NULL,
    "mpPaymentId" TEXT NOT NULL,
    "paymentId" TEXT,
    "invoiceId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "reason" TEXT,
    "reasonDetail" TEXT,
    "status" TEXT NOT NULL,
    "documentationStatus" TEXT,
    "documentationDeadline" TIMESTAMP(3),
    "covered" BOOLEAN,
    "coverageReason" TEXT,
    "mpCreatedAt" TIMESTAMP(3),
    "mpUpdatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chargebacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_outbound_queue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "sourceMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_outbound_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_type_configs_organizationId_idx" ON "service_type_configs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "service_type_configs_organizationId_code_key" ON "service_type_configs"("organizationId", "code");

-- CreateIndex
CREATE INDEX "job_assignments_jobId_idx" ON "job_assignments"("jobId");

-- CreateIndex
CREATE INDEX "job_assignments_technicianId_idx" ON "job_assignments"("technicianId");

-- CreateIndex
CREATE UNIQUE INDEX "job_assignments_jobId_technicianId_key" ON "job_assignments"("jobId", "technicianId");

-- CreateIndex
CREATE INDEX "price_items_organizationId_idx" ON "price_items"("organizationId");

-- CreateIndex
CREATE INDEX "price_items_type_idx" ON "price_items"("type");

-- CreateIndex
CREATE INDEX "price_items_isActive_idx" ON "price_items"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_business_accounts_organizationId_key" ON "whatsapp_business_accounts"("organizationId");

-- CreateIndex
CREATE INDEX "whatsapp_business_accounts_organizationId_idx" ON "whatsapp_business_accounts"("organizationId");

-- CreateIndex
CREATE INDEX "wa_conversations_organizationId_status_idx" ON "wa_conversations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "wa_conversations_organizationId_isUnread_idx" ON "wa_conversations"("organizationId", "isUnread");

-- CreateIndex
CREATE INDEX "wa_conversations_organizationId_lastMessageAt_idx" ON "wa_conversations"("organizationId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "wa_conversations_customerId_idx" ON "wa_conversations"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "wa_conversations_organizationId_customerPhone_key" ON "wa_conversations"("organizationId", "customerPhone");

-- CreateIndex
CREATE UNIQUE INDEX "wa_messages_waMessageId_key" ON "wa_messages"("waMessageId");

-- CreateIndex
CREATE INDEX "wa_messages_conversationId_createdAt_idx" ON "wa_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "wa_messages_organizationId_createdAt_idx" ON "wa_messages"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "wa_messages_waMessageId_idx" ON "wa_messages"("waMessageId");

-- CreateIndex
CREATE INDEX "wa_templates_organizationId_status_idx" ON "wa_templates"("organizationId", "status");

-- CreateIndex
CREATE INDEX "wa_templates_organizationId_category_idx" ON "wa_templates"("organizationId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "wa_templates_organizationId_name_language_key" ON "wa_templates"("organizationId", "name", "language");

-- CreateIndex
CREATE INDEX "wa_outbound_queue_organizationId_status_idx" ON "wa_outbound_queue"("organizationId", "status");

-- CreateIndex
CREATE INDEX "wa_outbound_queue_status_nextAttemptAt_idx" ON "wa_outbound_queue"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "wa_outbound_queue_scheduledFor_idx" ON "wa_outbound_queue"("scheduledFor");

-- CreateIndex
CREATE INDEX "wa_webhook_logs_organizationId_receivedAt_idx" ON "wa_webhook_logs"("organizationId", "receivedAt");

-- CreateIndex
CREATE INDEX "wa_webhook_logs_processed_idx" ON "wa_webhook_logs"("processed");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notification_preferences_organizationId_idx" ON "notification_preferences"("organizationId");

-- CreateIndex
CREATE INDEX "notification_logs_organizationId_idx" ON "notification_logs"("organizationId");

-- CreateIndex
CREATE INDEX "notification_logs_userId_idx" ON "notification_logs"("userId");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- CreateIndex
CREATE INDEX "notification_logs_createdAt_idx" ON "notification_logs"("createdAt");

-- CreateIndex
CREATE INDEX "tracking_location_history_sessionId_idx" ON "tracking_location_history"("sessionId");

-- CreateIndex
CREATE INDEX "tracking_location_history_recordedAt_idx" ON "tracking_location_history"("recordedAt");

-- CreateIndex
CREATE INDEX "events_organizationId_idx" ON "events"("organizationId");

-- CreateIndex
CREATE INDEX "events_type_idx" ON "events"("type");

-- CreateIndex
CREATE INDEX "events_severity_idx" ON "events"("severity");

-- CreateIndex
CREATE INDEX "events_createdAt_idx" ON "events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_userId_key" ON "onboarding_progress"("userId");

-- CreateIndex
CREATE INDEX "onboarding_progress_organizationId_idx" ON "onboarding_progress"("organizationId");

-- CreateIndex
CREATE INDEX "panic_modes_organizationId_idx" ON "panic_modes"("organizationId");

-- CreateIndex
CREATE INDEX "panic_modes_integration_idx" ON "panic_modes"("integration");

-- CreateIndex
CREATE INDEX "panic_modes_active_idx" ON "panic_modes"("active");

-- CreateIndex
CREATE INDEX "fallback_payments_orgId_idx" ON "fallback_payments"("orgId");

-- CreateIndex
CREATE INDEX "fallback_payments_invoiceId_idx" ON "fallback_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "fallback_payments_resolvedAt_idx" ON "fallback_payments"("resolvedAt");

-- CreateIndex
CREATE INDEX "employee_verification_tokens_userId_idx" ON "employee_verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "employee_verification_tokens_organizationId_idx" ON "employee_verification_tokens"("organizationId");

-- CreateIndex
CREATE INDEX "employee_verification_tokens_code_idx" ON "employee_verification_tokens"("code");

-- CreateIndex
CREATE INDEX "employee_verification_tokens_expiresAt_idx" ON "employee_verification_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "chargebacks_mpChargebackId_key" ON "chargebacks"("mpChargebackId");

-- CreateIndex
CREATE INDEX "chargebacks_orgId_idx" ON "chargebacks"("orgId");

-- CreateIndex
CREATE INDEX "chargebacks_status_idx" ON "chargebacks"("status");

-- CreateIndex
CREATE INDEX "chargebacks_createdAt_idx" ON "chargebacks"("createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_orgId_idx" ON "support_tickets"("orgId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets"("priority");

-- CreateIndex
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");

-- CreateIndex
CREATE INDEX "sms_outbound_queue_organizationId_idx" ON "sms_outbound_queue"("organizationId");

-- CreateIndex
CREATE INDEX "sms_outbound_queue_status_idx" ON "sms_outbound_queue"("status");

-- CreateIndex
CREATE INDEX "sms_outbound_queue_createdAt_idx" ON "sms_outbound_queue"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_vehicleId_key" ON "warehouses"("vehicleId");

-- CreateIndex
CREATE INDEX "warehouses_vehicleId_idx" ON "warehouses"("vehicleId");

-- AddForeignKey
ALTER TABLE "service_type_configs" ADD CONSTRAINT "service_type_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_business_accounts" ADD CONSTRAINT "whatsapp_business_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_conversations" ADD CONSTRAINT "wa_conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_conversations" ADD CONSTRAINT "wa_conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_conversations" ADD CONSTRAINT "wa_conversations_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "wa_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_templates" ADD CONSTRAINT "wa_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_outbound_queue" ADD CONSTRAINT "wa_outbound_queue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_webhook_logs" ADD CONSTRAINT "wa_webhook_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_location_history" ADD CONSTRAINT "tracking_location_history_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "tracking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panic_modes" ADD CONSTRAINT "panic_modes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fallback_payments" ADD CONSTRAINT "fallback_payments_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fallback_payments" ADD CONSTRAINT "fallback_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_verification_tokens" ADD CONSTRAINT "employee_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_verification_tokens" ADD CONSTRAINT "employee_verification_tokens_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_outbound_queue" ADD CONSTRAINT "sms_outbound_queue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
