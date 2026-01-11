/**
 * User Vehicle Usage API Route
 * ==============================
 * 
 * Phase 4.2: Driver Job History
 * 
 * GET /api/users/[id]/vehicles - Get all vehicles used by this user and job stats
 * 
 * Returns list of vehicles used by this driver with job counts and mileage info.
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

        // Verify user belongs to organization
        const user = await prisma.user.findFirst({
            where: { id, organizationId: session.organizationId },
            select: {
                id: true,
                name: true,
                phone: true,
                role: true,
                driverLicenseNumber: true,
                driverLicenseExpiry: true,
                driverLicenseCategory: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Usuario no encontrado' },
                { status: 404 }
            );
        }

        // Get URL params for filtering
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Build date filter
        const dateFilter: Record<string, unknown> = {};
        if (startDate || endDate) {
            dateFilter.scheduledDate = {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
            };
        }

        // Get all jobs for this technician with vehicle info
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const whereClause: any = {
            technicianId: id,
            organizationId: session.organizationId,
            vehicleId: { not: null },
            ...dateFilter,
        };

        const jobs = await prisma.job.findMany({
            where: whereClause,
            include: {
                vehicle: {
                    select: {
                        id: true,
                        plateNumber: true,
                        make: true,
                        model: true,
                    },
                },
            },
            orderBy: { scheduledDate: 'desc' },
        });

        // Group by vehicle
        const vehicleMap = new Map<string, {
            vehicle: { id: string; plateNumber: string; make: string; model: string };
            jobs: number;
            completedJobs: number;
            totalKilometers: number;
            lastUsedDate: Date | null;
        }>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jobs.forEach((job: any) => {
            if (!job.vehicle) return;

            const vehicleId = job.vehicle.id;
            const existing = vehicleMap.get(vehicleId) || {
                vehicle: job.vehicle,
                jobs: 0,
                completedJobs: 0,
                totalKilometers: 0,
                lastUsedDate: null,
            };

            existing.jobs++;

            if (job.status === 'COMPLETED') {
                existing.completedJobs++;
                if (job.vehicleMileageStart && job.vehicleMileageEnd) {
                    existing.totalKilometers += job.vehicleMileageEnd - job.vehicleMileageStart;
                }
            }

            if (job.scheduledDate && (!existing.lastUsedDate || job.scheduledDate > existing.lastUsedDate)) {
                existing.lastUsedDate = job.scheduledDate;
            }

            vehicleMap.set(vehicleId, existing);
        });

        // Convert to array
        const vehicleUsage = Array.from(vehicleMap.values()).map(v => ({
            vehicle: v.vehicle,
            totalJobs: v.jobs,
            completedJobs: v.completedJobs,
            totalKilometers: v.totalKilometers,
            lastUsedDate: v.lastUsedDate,
        }));

        // Sort by most recently used
        vehicleUsage.sort((a, b) => {
            if (!a.lastUsedDate) return 1;
            if (!b.lastUsedDate) return -1;
            return b.lastUsedDate.getTime() - a.lastUsedDate.getTime();
        });

        // Calculate overall summary
        const totalJobs = jobs.length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completedJobs = jobs.filter((j: any) => j.status === 'COMPLETED').length;
        const totalKilometers = vehicleUsage.reduce((sum, v) => sum + v.totalKilometers, 0);
        const vehiclesUsed = vehicleUsage.length;

        return NextResponse.json({
            success: true,
            data: {
                user: {
                    ...user,
                    licenseExpired: user.driverLicenseExpiry
                        ? new Date(user.driverLicenseExpiry) < new Date()
                        : false,
                },
                vehicleUsage,
                summary: {
                    totalJobs,
                    completedJobs,
                    totalKilometers,
                    totalKilometersFormatted: `${totalKilometers.toLocaleString()} km`,
                    vehiclesUsed,
                },
            },
        });
    } catch (error) {
        console.error('[UserVehicles] GET Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error obteniendo historial de vehículos' },
            { status: 500 }
        );
    }
}
