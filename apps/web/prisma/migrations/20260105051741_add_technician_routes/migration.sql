-- CreateTable
CREATE TABLE "technician_routes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "segment_number" INTEGER NOT NULL,
    "job_ids" TEXT[],
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "waypoints" TEXT[],
    "optimized_order" INTEGER[],
    "route_url" TEXT NOT NULL,
    "distance_meters" INTEGER,
    "duration_seconds" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "technician_routes_technician_id_date_idx" ON "technician_routes"("technician_id", "date");

-- CreateIndex
CREATE INDEX "technician_routes_organization_id_idx" ON "technician_routes"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "technician_routes_technician_id_date_segment_number_key" ON "technician_routes"("technician_id", "date", "segment_number");

-- AddForeignKey
ALTER TABLE "technician_routes" ADD CONSTRAINT "technician_routes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_routes" ADD CONSTRAINT "technician_routes_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
