/**
 * Vehicle Job History API Route
 * ==============================
 * 
 * Phase 4.1: Vehicle Job History
 * 
 * GET /api/vehicles/[id]/jobs - Get all jobs performed with this vehicle
 * 
 * Returns list of completed jobs with date, customer, technician, and mileage info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        const { id } = await params;

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Verify vehicle belongs to organization
        const vehicle = await prisma.vehicle.findFirst({
            where: { id, organizationId: session.organizationId },
            select: {
                id: true,
                plateNumber: true,
                make: true,
                model: true,
                currentMileage: true,
            },
        });

        if (!vehicle) {
            return NextResponse.json(
                { success: false, error: 'Vehículo no encontrado' },
                { status: 404 }
            );
        }

        // Get URL params for filtering
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const status = searchParams.get('status');

        // Build where clause with proper Prisma typing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const whereClause: any = {
            vehicleId: id,
            organizationId: session.organizationId,
        };

        // Date filtering
        if (startDate || endDate) {
            whereClause.scheduledDate = {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
            };
        }

        // Status filtering (default to completed jobs)
        if (status && status !== 'all') {
            whereClause.status = status.toUpperCase();
        }

        // Fetch jobs for this vehicle
        const jobs = await prisma.job.findMany({
            where: whereClause,
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        address: true,
                    },
                },
                technician: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { scheduledDate: 'desc' },
        });

        // Calculate summary stats
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completedJobs = jobs.filter((j: any) => j.status === 'COMPLETED');
        const totalJobs = jobs.length;

        // Calculate total kilometers from mileage records
        let totalKilometers = 0;
        for (const job of completedJobs) {
            if (job.vehicleMileageStart && job.vehicleMileageEnd) {
                totalKilometers += job.vehicleMileageEnd - job.vehicleMileageStart;
            }
        }

        // Format jobs for response
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedJobs = jobs.map((job: any) => ({
            id: job.id,
            jobNumber: job.jobNumber,
            status: job.status,
            serviceType: job.serviceType,
            description: job.description,
            scheduledDate: job.scheduledDate,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            customer: job.customer,
            technician: job.technician,
            // Mileage tracking
            vehicleMileageStart: job.vehicleMileageStart,
            vehicleMileageEnd: job.vehicleMileageEnd,
            tripDistance: job.vehicleMileageStart && job.vehicleMileageEnd
                ? job.vehicleMileageEnd - job.vehicleMileageStart
                : null,
            // Snapshot data (frozen at completion)
            vehiclePlateAtJob: job.vehiclePlateAtJob,
            driverNameAtJob: job.driverNameAtJob,
            driverLicenseAtJob: job.driverLicenseAtJob,
        }));

        return NextResponse.json({
            success: true,
            data: {
                vehicle,
                jobs: formattedJobs,
                summary: {
                    totalJobs,
                    completedJobs: completedJobs.length,
                    totalKilometers,
                    totalKilometersFormatted: `${totalKilometers.toLocaleString()} km`,
                },
            },
        });
    } catch (error) {
        console.error('[VehicleJobs] GET Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error obteniendo historial de trabajos' },
            { status: 500 }
        );
    }
}
