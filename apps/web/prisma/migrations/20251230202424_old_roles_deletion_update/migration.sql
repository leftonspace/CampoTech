/*
  Warnings:

  - The values [DISPATCHER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('PERCENTAGE', 'FREE_MONTHS', 'FIXED_AMOUNT', 'COMBINED');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('OWNER', 'ADMIN', 'TECHNICIAN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'TECHNICIAN';
COMMIT;

-- CreateTable
CREATE TABLE "global_discounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" "discount_type" NOT NULL,
    "percentage_off" DECIMAL(5,2),
    "free_months" INTEGER,
    "fixed_amount_off" DECIMAL(10,2),
    "combined_free_months" INTEGER,
    "combined_percentage_off" DECIMAL(5,2),
    "combined_percentage_months" INTEGER,
    "applicable_tiers" "subscription_tier"[],
    "applicable_cycles" "billing_cycle"[],
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "banner_text" TEXT,
    "badge_text" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_codes" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" "discount_type" NOT NULL,
    "percentage_off" DECIMAL(5,2),
    "free_months" INTEGER,
    "fixed_amount_off" DECIMAL(10,2),
    "combined_free_months" INTEGER,
    "combined_percentage_off" DECIMAL(5,2),
    "combined_percentage_months" INTEGER,
    "applicable_tiers" "subscription_tier"[],
    "applicable_cycles" "billing_cycle"[],
    "max_total_uses" INTEGER,
    "max_uses_per_org" INTEGER NOT NULL DEFAULT 1,
    "current_uses" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "discount_applied" JSONB NOT NULL,
    "original_price" DECIMAL(10,2) NOT NULL,
    "discounted_price" DECIMAL(10,2) NOT NULL,
    "amount_saved" DECIMAL(10,2) NOT NULL,
    "free_months_applied" INTEGER,
    "free_months_remaining" INTEGER,
    "discount_months_applied" INTEGER,
    "discount_months_remaining" INTEGER,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_settings" (
    "id" TEXT NOT NULL,
    "default_annual_discount" DECIMAL(5,2) NOT NULL DEFAULT 17,
    "show_discounts_publicly" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "global_discounts_is_active_idx" ON "global_discounts"("is_active");

-- CreateIndex
CREATE INDEX "global_discounts_valid_from_valid_until_idx" ON "global_discounts"("valid_from", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_codes_code_key" ON "coupon_codes"("code");

-- CreateIndex
CREATE INDEX "coupon_codes_code_idx" ON "coupon_codes"("code");

-- CreateIndex
CREATE INDEX "coupon_codes_is_active_idx" ON "coupon_codes"("is_active");

-- CreateIndex
CREATE INDEX "coupon_codes_valid_from_valid_until_idx" ON "coupon_codes"("valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "coupon_usages_coupon_id_idx" ON "coupon_usages"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_usages_organization_id_idx" ON "coupon_usages"("organization_id");

-- CreateIndex
CREATE INDEX "coupon_usages_subscription_id_idx" ON "coupon_usages"("subscription_id");

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupon_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organization_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
