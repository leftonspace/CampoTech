-- CreateEnum
CREATE TYPE "WhatsAppBSPProviderType" AS ENUM ('META_DIRECT', 'DIALOG_360', 'TWILIO');

-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('NOT_STARTED', 'NUMBER_SELECTED', 'VERIFICATION_PENDING', 'VERIFIED', 'ACTIVE', 'SUSPENDED', 'RELEASED');

-- AlterTable
ALTER TABLE "whatsapp_business_accounts" ADD COLUMN     "bspProvider" "WhatsAppBSPProviderType" NOT NULL DEFAULT 'META_DIRECT',
ADD COLUMN     "bspAccountId" TEXT,
ADD COLUMN     "bspPhoneNumberSid" TEXT,
ADD COLUMN     "provisioningStatus" "ProvisioningStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "provisionedAt" TIMESTAMP(3),
ADD COLUMN     "verificationCode" TEXT,
ADD COLUMN     "verificationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "monthlyMessageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastBillingReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "whatsapp_business_accounts_bspProvider_idx" ON "whatsapp_business_accounts"("bspProvider");

-- CreateIndex
CREATE INDEX "whatsapp_business_accounts_provisioningStatus_idx" ON "whatsapp_business_accounts"("provisioningStatus");
