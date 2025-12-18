-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "customerNumber" TEXT,
ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false;
