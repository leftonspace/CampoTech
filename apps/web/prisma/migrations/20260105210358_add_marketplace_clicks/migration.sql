/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `business_public_profiles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `business_public_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "business_public_profiles" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "marketplace_clicks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_slug" TEXT NOT NULL,
    "consumer_ip" TEXT,
    "consumer_fingerprint" TEXT,
    "consumer_user_agent" TEXT,
    "source" TEXT,
    "referrer" TEXT,
    "converted_job_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_clicks_converted_job_id_key" ON "marketplace_clicks"("converted_job_id");

-- CreateIndex
CREATE INDEX "marketplace_clicks_organization_id_clicked_at_idx" ON "marketplace_clicks"("organization_id", "clicked_at" DESC);

-- CreateIndex
CREATE INDEX "marketplace_clicks_business_slug_clicked_at_idx" ON "marketplace_clicks"("business_slug", "clicked_at" DESC);

-- CreateIndex
CREATE INDEX "marketplace_clicks_consumer_fingerprint_clicked_at_idx" ON "marketplace_clicks"("consumer_fingerprint", "clicked_at");

-- CreateIndex
CREATE INDEX "marketplace_clicks_organization_id_converted_at_idx" ON "marketplace_clicks"("organization_id", "converted_at");

-- CreateIndex
CREATE UNIQUE INDEX "business_public_profiles_slug_key" ON "business_public_profiles"("slug");

-- AddForeignKey
ALTER TABLE "marketplace_clicks" ADD CONSTRAINT "marketplace_clicks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_clicks" ADD CONSTRAINT "marketplace_clicks_converted_job_id_fkey" FOREIGN KEY ("converted_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
