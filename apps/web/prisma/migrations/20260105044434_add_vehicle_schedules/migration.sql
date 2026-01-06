-- CreateEnum
CREATE TYPE "VehicleScheduleType" AS ENUM ('PERMANENT', 'DATE_RANGE', 'RECURRING');

-- CreateTable
CREATE TABLE "vehicle_schedules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "scheduleType" "VehicleScheduleType" NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "timeStart" TEXT,
    "timeEnd" TEXT,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_schedules_organizationId_idx" ON "vehicle_schedules"("organizationId");

-- CreateIndex
CREATE INDEX "vehicle_schedules_userId_startDate_endDate_idx" ON "vehicle_schedules"("userId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "vehicle_schedules_vehicleId_startDate_endDate_idx" ON "vehicle_schedules"("vehicleId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "vehicle_schedules_scheduleType_idx" ON "vehicle_schedules"("scheduleType");

-- AddForeignKey
ALTER TABLE "vehicle_schedules" ADD CONSTRAINT "vehicle_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_schedules" ADD CONSTRAINT "vehicle_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_schedules" ADD CONSTRAINT "vehicle_schedules_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_schedules" ADD CONSTRAINT "vehicle_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
