/*
  Warnings:

  - The values [ADMIN,VIEWER,ACCOUNTANT] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `jobs_partitioned` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `login_attempts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `login_lockouts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refresh_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tech_location_history_partitioned` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wa_messages_partitioned` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[token]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "JobDurationType" AS ENUM ('SINGLE_VISIT', 'MULTI_DAY', 'MULTIPLE_VISITS', 'RECURRING', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "RecurrencePattern" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL', 'CUSTOM');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('OWNER', 'DISPATCHER', 'TECHNICIAN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'TECHNICIAN';
COMMIT;

-- DropForeignKey
ALTER TABLE "login_attempts" DROP CONSTRAINT "login_attempts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_fkey";

-- DropIndex
DROP INDEX "idx_profiles_categories_gin";

-- AlterTable
ALTER TABLE "business_public_profiles" ALTER COLUMN "categories" DROP DEFAULT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "durationType" "JobDurationType" NOT NULL DEFAULT 'SINGLE_VISIT',
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "flexibleEndDate" TIMESTAMP(3),
ADD COLUMN     "flexibleStartDate" TIMESTAMP(3),
ADD COLUMN     "recurrenceCount" INTEGER,
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3),
ADD COLUMN     "recurrenceInterval" INTEGER,
ADD COLUMN     "recurrencePattern" "RecurrencePattern",
ADD COLUMN     "visitCount" INTEGER,
ADD COLUMN     "visitIntervalDays" INTEGER;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "token" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "jobs_partitioned";

-- DropTable
DROP TABLE "login_attempts";

-- DropTable
DROP TABLE "login_lockouts";

-- DropTable
DROP TABLE "refresh_tokens";

-- DropTable
DROP TABLE "tech_location_history_partitioned";

-- DropTable
DROP TABLE "wa_messages_partitioned";

-- CreateTable
CREATE TABLE "job_visits" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "visitNumber" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledTimeSlot" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "technicianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_schedules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_configurations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoResponseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minConfidenceToRespond" INTEGER NOT NULL DEFAULT 70,
    "minConfidenceToCreateJob" INTEGER NOT NULL DEFAULT 85,
    "dataAccessPermissions" JSONB NOT NULL DEFAULT '{"companyInfo":true,"services":true,"pricing":true,"businessHours":true,"serviceAreas":true,"technicianNames":false,"technicianAvailability":true,"scheduleSlots":true,"faq":true,"policies":true}',
    "companyName" TEXT,
    "companyDescription" TEXT,
    "servicesOffered" JSONB NOT NULL DEFAULT '[]',
    "businessHours" JSONB NOT NULL DEFAULT '{}',
    "serviceAreas" TEXT,
    "pricingInfo" TEXT,
    "cancellationPolicy" TEXT,
    "paymentMethods" TEXT,
    "warrantyInfo" TEXT,
    "faqItems" JSONB NOT NULL DEFAULT '[]',
    "customInstructions" TEXT,
    "aiTone" TEXT NOT NULL DEFAULT 'friendly_professional',
    "greetingMessage" TEXT,
    "awayMessage" TEXT,
    "transferKeywords" JSONB NOT NULL DEFAULT '[]',
    "escalationUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversation_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "customerMessage" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "transcription" TEXT,
    "detectedIntent" TEXT,
    "extractedEntities" JSONB,
    "confidenceScore" INTEGER NOT NULL,
    "aiResponse" TEXT,
    "responseStatus" TEXT NOT NULL,
    "jobCreated" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "transferredToUserId" TEXT,
    "transferReason" TEXT,
    "wasHelpful" BOOLEAN,
    "correctedResponse" TEXT,
    "feedbackNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_visits_jobId_idx" ON "job_visits"("jobId");

-- CreateIndex
CREATE INDEX "job_visits_scheduledDate_idx" ON "job_visits"("scheduledDate");

-- CreateIndex
CREATE INDEX "job_visits_status_idx" ON "job_visits"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_visits_jobId_visitNumber_key" ON "job_visits"("jobId", "visitNumber");

-- CreateIndex
CREATE INDEX "employee_schedules_organizationId_idx" ON "employee_schedules"("organizationId");

-- CreateIndex
CREATE INDEX "employee_schedules_userId_idx" ON "employee_schedules"("userId");

-- CreateIndex
CREATE INDEX "employee_schedules_organizationId_dayOfWeek_idx" ON "employee_schedules"("organizationId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "employee_schedules_userId_dayOfWeek_key" ON "employee_schedules"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "schedule_exceptions_organizationId_idx" ON "schedule_exceptions"("organizationId");

-- CreateIndex
CREATE INDEX "schedule_exceptions_userId_idx" ON "schedule_exceptions"("userId");

-- CreateIndex
CREATE INDEX "schedule_exceptions_date_idx" ON "schedule_exceptions"("date");

-- CreateIndex
CREATE INDEX "schedule_exceptions_organizationId_date_idx" ON "schedule_exceptions"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_exceptions_userId_date_key" ON "schedule_exceptions"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ai_configurations_organizationId_key" ON "ai_configurations"("organizationId");

-- CreateIndex
CREATE INDEX "ai_conversation_logs_organizationId_idx" ON "ai_conversation_logs"("organizationId");

-- CreateIndex
CREATE INDEX "ai_conversation_logs_conversationId_idx" ON "ai_conversation_logs"("conversationId");

-- CreateIndex
CREATE INDEX "ai_conversation_logs_createdAt_idx" ON "ai_conversation_logs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_conversation_logs_responseStatus_idx" ON "ai_conversation_logs"("responseStatus");

-- CreateIndex
CREATE INDEX "ai_conversation_logs_confidenceScore_idx" ON "ai_conversation_logs"("confidenceScore");

-- CreateIndex
CREATE INDEX "jobs_durationType_idx" ON "jobs"("durationType");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_token_key" ON "reviews"("token");

-- CreateIndex
CREATE INDEX "reviews_token_idx" ON "reviews"("token");

-- AddForeignKey
ALTER TABLE "job_visits" ADD CONSTRAINT "job_visits_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_visits" ADD CONSTRAINT "job_visits_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_configurations" ADD CONSTRAINT "ai_configurations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_configurations" ADD CONSTRAINT "ai_configurations_escalationUserId_fkey" FOREIGN KEY ("escalationUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_logs" ADD CONSTRAINT "ai_conversation_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_profiles_active_rating" RENAME TO "business_public_profiles_isActive_averageRating_idx";

-- RenameIndex
ALTER INDEX "idx_profiles_average_rating" RENAME TO "business_public_profiles_averageRating_idx";

-- RenameIndex
ALTER INDEX "idx_profiles_is_active" RENAME TO "business_public_profiles_isActive_idx";

-- RenameIndex
ALTER INDEX "idx_jobs_org_scheduled_date" RENAME TO "jobs_organizationId_scheduledDate_idx";

-- RenameIndex
ALTER INDEX "idx_jobs_org_status" RENAME TO "jobs_organizationId_status_idx";

-- RenameIndex
ALTER INDEX "idx_jobs_technician_status" RENAME TO "jobs_technicianId_status_idx";

-- RenameIndex
ALTER INDEX "idx_reviews_org_rating" RENAME TO "reviews_organizationId_rating_idx";
