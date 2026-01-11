-- AlterTable
ALTER TABLE "users" ADD COLUMN     "certifications" JSONB,
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[];
