/**
 * Job Complete API Route
 * =======================
 * 
 * Phase 3: Job Completion Snapshot
 * 
 * POST /api/jobs/[id]/complete - Complete a job with vehicle/driver snapshot
 * 
 * This endpoint:
 * 1. Validates the job can be completed
 * 2. Captures end mileage
 * 3. Creates an immutable snapshot of vehicle plate and driver license
 * 4. Updates the vehicle's current mileage
 * 5. Calculates trip distance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { completeJobWithSnapshot, calculateJobDuration } from '@/lib/services/job-completion';
import { jobRouteIntegrationService } from '@/lib/services/job-route-integration.service';
import { randomUUID } from 'crypto';

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
        const { mileageEnd, notes, photos, customerSignature, skipWarnings } = body;

        // Get the existing job
        const existing = await prisma.job.findFirst({
            where: { id, organizationId: session.organizationId },
            include: {
                vehicle: true,
                technician: true,
                assignments: true,
            },
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        // Verify the job is in progress (can be completed)
        if (existing.status !== 'IN_PROGRESS' && existing.status !== 'EN_ROUTE') {
            return NextResponse.json(
                {
                    success: false,
                    error: `No se puede completar un trabajo en estado "${existing.status}". El trabajo debe estar "En trabajo" o "En camino".`
                },
                { status: 400 }
            );
        }

        // Verify the user is assigned to this job (for technicians)
        const isAssigned = existing.technicianId === session.userId ||
            existing.assignments.some((a: { technicianId: string }) => a.technicianId === session.userId);

        if (session.role === 'TECHNICIAN' && !isAssigned) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para completar este trabajo' },
                { status: 403 }
            );
        }

        // Call the completion service
        const { job, snapshot, warnings } = await completeJobWithSnapshot(
            session.organizationId,
            id,
            {
                mileageEnd,
                notes,
                photos,
                customerSignature,
            }
        );

        // If there are warnings and user hasn't acknowledged them, return for confirmation
        if (warnings.length > 0 && !skipWarnings) {
            return NextResponse.json({
                success: false,
                requiresConfirmation: true,
                warnings,
                message: 'Por favor confirme que desea completar el trabajo con las siguientes advertencias:',
            });
        }

        // Calculate actual duration
        const actualDuration = calculateJobDuration(existing.startedAt, new Date());
        if (actualDuration !== null) {
            await prisma.job.update({
                where: { id },
                data: { actualDuration },
            });
        }

        // Generate rating token for customer feedback
        let ratingToken: string | null = null;
        try {
            const existingReview = await prisma.review.findFirst({
                where: { jobId: id },
            });

            if (!existingReview) {
                ratingToken = randomUUID();
                await prisma.review.create({
                    data: {
                        jobId: id,
                        organizationId: session.organizationId,
                        customerId: job.customerId || null,
                        technicianId: job.technicianId || null,
                        token: ratingToken,
                        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                    },
                });
            } else if (existingReview.token) {
                ratingToken = existingReview.token;
            }
        } catch (reviewError) {
            console.error('Error creating rating token:', reviewError);
        }

        // Trigger route integration (non-blocking)
        jobRouteIntegrationService.onJobCompleted(id).catch((err) => {
            console.error('Route integration error:', err);
        });

        // Phase 2: Trigger automatic document delivery for ALL completed jobs
        // This sends completion report + invoice (if exists) + rating link to customer via WhatsApp
        // No signature requirement - most jobs complete without formal signature
        try {
            const { queueDocumentDelivery } = await import('@/lib/services/job-completion-documents');
            queueDocumentDelivery(id, session.organizationId, ratingToken).catch((err) => {
                console.error('[JobComplete] Document delivery queue error:', err);
            });
        } catch (docError) {
            // Non-blocking - log but don't fail the completion
            console.error('[JobComplete] Document delivery error:', docError);
        }

        return NextResponse.json({
            success: true,
            data: {
                ...job,
                actualDuration,
                ratingToken,
                ratingUrl: ratingToken ? `/rate/${ratingToken}` : null,
            },
            snapshot,
            warnings,
            message: 'Trabajo completado exitosamente',
            tripSummary: snapshot.tripDistance !== null
                ? {
                    startMileage: existing.vehicleMileageStart,
                    endMileage: mileageEnd,
                    distance: snapshot.tripDistance,
                    distanceFormatted: `${snapshot.tripDistance.toLocaleString()} km`,
                }
                : null,
        });
    } catch (error) {
        console.error('[JobComplete] Error:', error);
        const message = error instanceof Error ? error.message : 'Error al completar el trabajo';
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

/**
 * GET - Get completion requirements and current state
 */
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

        const job = await prisma.job.findFirst({
            where: { id, organizationId: session.organizationId },
            include: {
                vehicle: {
                    select: {
                        id: true,
                        plateNumber: true,
                        make: true,
                        model: true,
                        currentMileage: true,
                    },
                },
                technician: {
                    select: {
                        id: true,
                        name: true,
                        driverLicenseNumber: true,
                        driverLicenseExpiry: true,
                        driverLicenseCategory: true,
                    },
                },
                customer: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
            },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        // Check if mileage input is required
        const requiresMileage = job.vehicle !== null && job.vehicleMileageStart !== null;

        // Get minimum mileage (must be >= start mileage or vehicle current mileage)
        const minimumMileage = Math.max(
            job.vehicleMileageStart || 0,
            job.vehicle?.currentMileage || 0
        );

        return NextResponse.json({
            success: true,
            data: {
                job: {
                    id: job.id,
                    jobNumber: job.jobNumber,
                    status: job.status,
                    serviceType: job.serviceType,
                    description: job.description,
                    startedAt: job.startedAt,
                    vehicleMileageStart: job.vehicleMileageStart,
                },
                vehicle: job.vehicle,
                technician: job.technician,
                customer: job.customer,
                requirements: {
                    requiresMileage,
                    minimumMileage,
                    canComplete: job.status === 'IN_PROGRESS' || job.status === 'EN_ROUTE',
                },
                previewSnapshot: {
                    vehiclePlate: job.vehicle?.plateNumber || null,
                    driverName: job.technician?.name || null,
                    driverLicense: job.technician?.driverLicenseNumber || null,
                },
            },
        });
    } catch (error) {
        console.error('[JobComplete] GET Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error obteniendo datos de completación' },
            { status: 500 }
        );
    }
}
