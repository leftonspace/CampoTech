/**
 * Job Start API Route
 * ====================
 * 
 * Phase 2.3: Mileage Input at Job Start
 * 
 * POST /api/jobs/[id]/start - Start a job with optional mileage input
 * 
 * When a job is started, the technician can input the vehicle's current mileage.
 * This creates an audit trail for insurance and expense tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { JobService } from '@/src/services/job.service';
import { jobRouteIntegrationService } from '@/lib/services/job-route-integration.service';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        const { id } = await params;

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { mileageStart } = body;

        // Get the existing job
        const existing = await JobService.getJobById(session.organizationId, id);

        if (!existing) {
            return NextResponse.json(
                { success: false, error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        // Verify the user is assigned to this job (for technicians)
        const isAssigned = existing.technicianId === session.userId ||
            existing.assignments.some((a: { technicianId: string }) => a.technicianId === session.userId);

        if (session.role === 'TECHNICIAN' && !isAssigned) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para iniciar este trabajo' },
                { status: 403 }
            );
        }

        // Validate mileage if provided
        if (mileageStart !== undefined && mileageStart !== null) {
            if (typeof mileageStart !== 'number' || mileageStart < 0) {
                return NextResponse.json(
                    { success: false, error: 'El kilometraje debe ser un número positivo' },
                    { status: 400 }
                );
            }

            // If vehicle is assigned, validate mileage against vehicle's current mileage
            if (existing.vehicleId && existing.vehicle) {
                const vehicle = await prisma.vehicle.findUnique({
                    where: { id: existing.vehicleId },
                    select: { id: true, currentMileage: true, plateNumber: true },
                });

                if (vehicle?.currentMileage && mileageStart < vehicle.currentMileage) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: `El kilometraje inicial (${mileageStart}) no puede ser menor al kilometraje actual del vehículo (${vehicle.currentMileage})`,
                            vehicleMileage: vehicle.currentMileage,
                        },
                        { status: 400 }
                    );
                }

                // Update vehicle's current mileage if the new reading is higher
                if (!vehicle?.currentMileage || mileageStart > vehicle.currentMileage) {
                    await prisma.vehicle.update({
                        where: { id: existing.vehicleId },
                        data: { currentMileage: mileageStart },
                    });
                }
            }
        }

        // Update job status to IN_PROGRESS and record mileage
        const job = await prisma.job.update({
            where: { id, organizationId: session.organizationId },
            data: {
                status: 'IN_PROGRESS',
                startedAt: new Date(),
                vehicleMileageStart: mileageStart ?? null,
            },
            include: {
                customer: true,
                technician: { select: { id: true, name: true } },
                vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
            },
        });

        // Trigger route integration (non-blocking)
        if (job.technicianId && job.scheduledDate) {
            jobRouteIntegrationService.onJobChange({
                jobId: id,
                technicianId: job.technicianId,
                organizationId: session.organizationId,
                scheduledDate: job.scheduledDate,
                status: job.status,
            }).catch((err) => {
                console.error('Route integration error:', err);
            });
        }

        return NextResponse.json({
            success: true,
            data: job,
            message: mileageStart
                ? `Trabajo iniciado con kilometraje inicial: ${mileageStart} km`
                : 'Trabajo iniciado',
        });
    } catch (error) {
        console.error('[JobStart] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al iniciar el trabajo' },
            { status: 500 }
        );
    }
}
