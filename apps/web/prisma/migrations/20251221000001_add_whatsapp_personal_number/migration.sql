-- CreateEnum
CREATE TYPE "WhatsAppIntegrationType" AS ENUM ('NONE', 'WAME_LINK', 'BSP_API');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "whatsappPersonalNumber" TEXT,
ADD COLUMN     "whatsappIntegrationType" "WhatsAppIntegrationType" NOT NULL DEFAULT 'NONE';
