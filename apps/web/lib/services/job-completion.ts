/**
 * Job Completion Service
 * =======================
 * 
 * Phase 3: Job Completion Snapshot
 * 
 * This service handles job completion with vehicle/driver snapshot
 * for insurance and audit purposes.
 */

import { prisma } from '@/lib/prisma';

export interface JobCompletionData {
    mileageEnd: number;
    notes?: string;
    photos?: string[];
    customerSignature?: string;
}

export interface SnapshotResult {
    vehiclePlateAtJob: string | null;
    driverNameAtJob: string | null;
    driverLicenseAtJob: string | null;
    tripDistance: number | null;
}

/**
 * Creates an immutable snapshot of the vehicle and driver at job completion.
 * This data is frozen for insurance/audit purposes.
 */
export async function snapshotVehicleDriver(jobId: string): Promise<SnapshotResult> {
    // Get job with vehicle and technician info
    const job = await prisma.job.findUnique({
        where: { id: jobId },
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
        },
    });

    if (!job) {
        throw new Error('Job not found');
    }

    // Create snapshot data
    const snapshot: SnapshotResult = {
        vehiclePlateAtJob: job.vehicle?.plateNumber || null,
        driverNameAtJob: job.technician?.name || null,
        driverLicenseAtJob: job.technician?.driverLicenseNumber || null,
        tripDistance: null,
    };

    // Calculate trip distance if both mileages are available
    if (job.vehicleMileageStart && job.vehicleMileageEnd) {
        snapshot.tripDistance = job.vehicleMileageEnd - job.vehicleMileageStart;
    }

    return snapshot;
}

/**
 * Completes a job with full vehicle/driver snapshotting
 * Phase 6: Now snapshots all visit-level vehicle/driver assignments
 */
// Type for the completed job with relations
interface CompletedJobWithRelations {
    id: string;
    status: string;
    completedAt: Date | null;
    customer: { id: string; name: string | null } | null;
    technician: { id: string; name: string } | null;
    vehicle: { id: string; plateNumber: string | null; make: string | null; model: string | null } | null;
    [key: string]: unknown;
}

export async function completeJobWithSnapshot(
    orgId: string,
    jobId: string,
    data: JobCompletionData
): Promise<{ job: CompletedJobWithRelations; snapshot: SnapshotResult; warnings: string[] }> {
    const warnings: string[] = [];

    // Get job with vehicle info and Phase 6 visit assignments
    const job = await prisma.job.findFirst({
        where: { id: jobId, organizationId: orgId },
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
            // Phase 6: Include visit vehicle assignments for snapshotting
            visits: {
                include: {
                    vehicleAssignments: {
                        include: {
                            vehicle: {
                                select: {
                                    id: true,
                                    plateNumber: true,
                                    make: true,
                                    model: true,
                                },
                            },
                            drivers: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            driverLicenseNumber: true,
                                            driverLicenseExpiry: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!job) {
        throw new Error('Job not found');
    }

    // Validate mileage
    const { mileageEnd } = data;

    if (job.vehicleMileageStart !== null && mileageEnd !== undefined) {
        // Validate that end mileage is >= start mileage
        if (mileageEnd < (job.vehicleMileageStart || 0)) {
            throw new Error(
                `El kilometraje final (${mileageEnd}) no puede ser menor al kilometraje inicial (${job.vehicleMileageStart})`
            );
        }

        // Calculate trip distance
        const tripDistance = mileageEnd - (job.vehicleMileageStart || 0);

        // Warn if trip seems unusually long (>500km for a single job)
        if (tripDistance > 500) {
            warnings.push(
                `Distancia recorrida muy alta: ${tripDistance} km. Por favor verificar que el kilometraje sea correcto.`
            );
        }

        // Warn if trip seems unusually short (<1km)
        if (tripDistance > 0 && tripDistance < 1) {
            warnings.push(
                `Distancia recorrida muy corta: ${tripDistance} km. ¿El vehículo no se movió?`
            );
        }
    }

    // Check if driver has a license
    if (job.technician && !job.technician.driverLicenseNumber) {
        warnings.push(
            `El técnico ${job.technician.name} no tiene licencia de conducir registrada en el sistema.`
        );
    }

    // Check if driver's license is expired
    if (job.technician?.driverLicenseExpiry) {
        const expiryDate = new Date(job.technician.driverLicenseExpiry);
        if (expiryDate < new Date()) {
            warnings.push(
                `La licencia de conducir de ${job.technician.name} está vencida desde ${expiryDate.toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' })}.`
            );
        }
    }

    // Phase 6: Check all drivers in visit assignments for license issues
    for (const visit of job.visits) {
        for (const vehicleAssignment of visit.vehicleAssignments) {
            for (const driver of vehicleAssignment.drivers) {
                if (!driver.user.driverLicenseNumber) {
                    warnings.push(
                        `El técnico ${driver.user.name} no tiene licencia de conducir registrada (vehículo: ${vehicleAssignment.vehicle.plateNumber || 'sin patente'}).`
                    );
                } else if (driver.user.driverLicenseExpiry) {
                    const expiry = new Date(driver.user.driverLicenseExpiry);
                    if (expiry < new Date()) {
                        warnings.push(
                            `La licencia de ${driver.user.name} está vencida desde ${expiry.toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' })} (vehículo: ${vehicleAssignment.vehicle.plateNumber || 'sin patente'}).`
                        );
                    }
                }
            }
        }
    }

    // Create snapshot data (legacy - for job-level single vehicle/driver)
    const snapshotData: SnapshotResult = {
        vehiclePlateAtJob: job.vehicle?.plateNumber || null,
        driverNameAtJob: job.technician?.name || null,
        driverLicenseAtJob: job.technician?.driverLicenseNumber || null,
        tripDistance: job.vehicleMileageStart !== null && mileageEnd !== undefined
            ? mileageEnd - (job.vehicleMileageStart || 0)
            : null,
    };

    // Update job with completion data and snapshot
    const updatedJob = await prisma.$transaction(async (tx) => {
        // Update the job
        const completed = await tx.job.update({
            where: { id: jobId, organizationId: orgId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                resolution: data.notes || null,
                photos: data.photos || [],
                customerSignature: data.customerSignature || null,
                vehicleMileageEnd: mileageEnd ?? null,
                // Snapshot fields - frozen for audit (legacy job-level)
                vehiclePlateAtJob: snapshotData.vehiclePlateAtJob,
                driverNameAtJob: snapshotData.driverNameAtJob,
                driverLicenseAtJob: snapshotData.driverLicenseAtJob,
            },
            include: {
                customer: true,
                technician: { select: { id: true, name: true } },
                vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
            },
        });

        // Update vehicle's current mileage if end mileage is provided
        if (job.vehicle && mileageEnd !== undefined) {
            const vehicleMileage = job.vehicle.currentMileage || 0;
            if (mileageEnd > vehicleMileage) {
                await tx.vehicle.update({
                    where: { id: job.vehicle.id },
                    data: { currentMileage: mileageEnd },
                });
            }
        }

        // Phase 6: Snapshot all visit-level vehicle/driver assignments
        // "Lock on Complete" pattern - immutable forensic record
        for (const visit of job.visits) {
            for (const vehicleAssignment of visit.vehicleAssignments) {
                // Snapshot vehicle data
                await tx.jobVisitVehicle.update({
                    where: { id: vehicleAssignment.id },
                    data: {
                        vehiclePlateSnapshot: vehicleAssignment.vehicle.plateNumber,
                        vehicleMakeSnapshot: vehicleAssignment.vehicle.make,
                        vehicleModelSnapshot: vehicleAssignment.vehicle.model,
                    },
                });

                // Snapshot driver data
                for (const driver of vehicleAssignment.drivers) {
                    await tx.jobVisitVehicleDriver.update({
                        where: { id: driver.id },
                        data: {
                            driverNameSnapshot: driver.user.name,
                            driverLicenseSnapshot: driver.user.driverLicenseNumber,
                        },
                    });
                }
            }
        }

        return completed;
    });

    return {
        job: updatedJob,
        snapshot: snapshotData,
        warnings,
    };
}

/**
 * Calculate the actual duration of a job in minutes
 */
export function calculateJobDuration(startedAt: Date | null, completedAt: Date): number | null {
    if (!startedAt) return null;
    const durationMs = completedAt.getTime() - new Date(startedAt).getTime();
    return Math.round(durationMs / (1000 * 60)); // Convert to minutes
}
