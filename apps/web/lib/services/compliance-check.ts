/**
 * Compliance Check Service
 * ========================
 * 
 * Phase 5: Compliance Alerts
 * 
 * Handles driver's license expiry tracking and vehicle-driver mismatch alerts
 * for insurance and compliance purposes.
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DriverLicenseStatus {
    userId: string;
    userName: string;
    email: string | null;
    organizationId: string;
    organizationName: string;
    driverLicenseNumber: string | null;
    driverLicenseExpiry: Date | null;
    driverLicenseCategory: string | null;
    status: 'valid' | 'expiring' | 'expired' | 'missing';
    daysUntilExpiry: number | null;
}

export interface VehicleDriverMismatch {
    jobId: string;
    jobNumber: string;
    technicianId: string;
    technicianName: string;
    organizationId: string;
    issueType: 'no_license' | 'expired_license' | 'no_vehicle_assigned';
    message: string;
    scheduledDate: Date | null;
}

export interface ComplianceSummary {
    licensesExpiring30Days: number;
    licensesExpiring7Days: number;
    licensesExpired: number;
    techniciansWithoutLicense: number;
    vehicleInsuranceExpiring30Days: number;
    vehicleInsuranceExpired: number;
    vtvExpiring30Days: number;
    totalIssues: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER'S LICENSE CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all users with driver's licenses expiring within a given number of days
 * @param orgId Organization ID (optional, checks all orgs if not provided)
 * @param daysAhead Number of days to look ahead
 */
export async function checkExpiringLicenses(
    orgId?: string,
    daysAhead: number = 30
): Promise<DriverLicenseStatus[]> {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    const users = await prisma.user.findMany({
        where: {
            ...(orgId ? { organizationId: orgId } : {}),
            driverLicenseExpiry: {
                gte: now,      // Not yet expired
                lte: cutoffDate // But expires within daysAhead
            },
            isActive: true
        },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    // Map users to DriverLicenseStatus with explicit typing
    return users.map((user: typeof users[number]) => ({
        userId: user.id,
        userName: user.name,
        email: user.email,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        driverLicenseNumber: user.driverLicenseNumber,
        driverLicenseExpiry: user.driverLicenseExpiry,
        driverLicenseCategory: user.driverLicenseCategory,
        status: 'expiring' as const,
        daysUntilExpiry: user.driverLicenseExpiry
            ? Math.ceil((user.driverLicenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null
    }));
}

/**
 * Get all users with expired driver's licenses
 * @param orgId Organization ID (optional)
 */
export async function checkExpiredLicenses(
    orgId?: string
): Promise<DriverLicenseStatus[]> {
    const now = new Date();

    const users = await prisma.user.findMany({
        where: {
            ...(orgId ? { organizationId: orgId } : {}),
            driverLicenseExpiry: {
                lt: now // Already expired
            },
            isActive: true
        },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    // Map users to DriverLicenseStatus with explicit typing
    return users.map((user: typeof users[number]) => ({
        userId: user.id,
        userName: user.name,
        email: user.email,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        driverLicenseNumber: user.driverLicenseNumber,
        driverLicenseExpiry: user.driverLicenseExpiry,
        driverLicenseCategory: user.driverLicenseCategory,
        status: 'expired' as const,
        daysUntilExpiry: user.driverLicenseExpiry
            ? Math.ceil((user.driverLicenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null
    }));
}

/**
 * Get all users without a driver's license registered
 * @param orgId Organization ID (optional)
 */
export async function checkMissingLicenses(
    orgId?: string
): Promise<DriverLicenseStatus[]> {
    // Only check users who have vehicle assignments (drivers)
    const users = await prisma.user.findMany({
        where: {
            ...(orgId ? { organizationId: orgId } : {}),
            driverLicenseNumber: null,
            isActive: true,
            // Only check users with vehicle assignments
            vehicleAssignments: {
                some: {}
            }
        },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    // Map users to DriverLicenseStatus with explicit typing
    return users.map((user: typeof users[number]) => ({
        userId: user.id,
        userName: user.name,
        email: user.email,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        driverLicenseNumber: null,
        driverLicenseExpiry: null,
        driverLicenseCategory: null,
        status: 'missing' as const,
        daysUntilExpiry: null
    }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE-DRIVER MISMATCH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check for jobs assigned to technicians without driver's licenses
 * These are soft warnings (not blocking)
 * @param orgId Organization ID (optional)
 * @param daysAhead How many days of future jobs to check
 */
export async function checkVehicleDriverMismatches(
    orgId?: string,
    daysAhead: number = 7
): Promise<VehicleDriverMismatch[]> {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    const mismatches: VehicleDriverMismatch[] = [];

    // Find jobs with vehicles assigned but technicians without licenses
    const jobs = await prisma.job.findMany({
        where: {
            ...(orgId ? { organizationId: orgId } : {}),
            vehicleId: { not: null },
            status: { in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS'] },
            scheduledDate: {
                gte: now,
                lte: cutoffDate
            }
        },
        include: {
            technician: {
                select: {
                    id: true,
                    name: true,
                    driverLicenseNumber: true,
                    driverLicenseExpiry: true
                }
            }
        }
    });

    for (const job of jobs) {
        if (!job.technician) continue;

        // Check if technician has no license
        if (!job.technician.driverLicenseNumber) {
            mismatches.push({
                jobId: job.id,
                jobNumber: job.jobNumber,
                technicianId: job.technician.id,
                technicianName: job.technician.name,
                organizationId: job.organizationId,
                issueType: 'no_license',
                message: `${job.technician.name} no tiene licencia de conducir registrada`,
                scheduledDate: job.scheduledDate
            });
        }
        // Check if technician's license is expired
        else if (job.technician.driverLicenseExpiry && job.technician.driverLicenseExpiry < now) {
            mismatches.push({
                jobId: job.id,
                jobNumber: job.jobNumber,
                technicianId: job.technician.id,
                technicianName: job.technician.name,
                organizationId: job.organizationId,
                issueType: 'expired_license',
                message: `La licencia de ${job.technician.name} está vencida desde ${job.technician.driverLicenseExpiry.toLocaleDateString('es-AR', {
                    timeZone: 'America/Argentina/Buenos_Aires'
                })
                    }`,
                scheduledDate: job.scheduledDate
            });
        }
    }

    return mismatches;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE INSURANCE & VTV CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check for vehicles with expiring or expired insurance
 * @param orgId Organization ID (optional)
 * @param daysAhead Number of days to look ahead
 */
export async function checkVehicleInsurance(
    orgId?: string,
    daysAhead: number = 30
): Promise<{ expiring: number; expired: number; vehicles: Array<{ id: string; plateNumber: string | null; insuranceExpiry: Date | null; status: string }> }> {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    // Check expiring insurance
    const expiringVehicles = await prisma.vehicle.findMany({
        where: {
            ...(orgId ? { organizationId: orgId } : {}),
            insuranceExpiry: {
                gte: now,
                lte: cutoffDate
            },
            status: 'ACTIVE'
        },
        select: {
            id: true,
            plateNumber: true,
            insuranceExpiry: true
        }
    });

    // Check expired insurance
    const expiredVehicles = await prisma.vehicle.findMany({
        where: {
            ...(orgId ? { organizationId: orgId } : {}),
            insuranceExpiry: {
                lt: now
            },
            status: 'ACTIVE'
        },
        select: {
            id: true,
            plateNumber: true,
            insuranceExpiry: true
        }
    });

    return {
        expiring: expiringVehicles.length,
        expired: expiredVehicles.length,
        vehicles: [
            ...expiringVehicles.map((v: typeof expiringVehicles[number]) => ({ ...v, status: 'expiring' as const })),
            ...expiredVehicles.map((v: typeof expiredVehicles[number]) => ({ ...v, status: 'expired' as const }))
        ]
    };
}

/**
 * Check for vehicles with expiring or expired VTV (Verificación Técnica Vehicular)
 * @param orgId Organization ID (optional)
 * @param daysAhead Number of days to look ahead
 */
export async function checkVehicleVTV(
    orgId?: string,
    daysAhead: number = 30
): Promise<{ expiring: number; expired: number }> {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    // Check expiring VTV
    const expiringCount = await prisma.vehicle.count({
        where: {
            ...(orgId ? { organizationId: orgId } : {}),
            registrationExpiry: {
                gte: now,
                lte: cutoffDate
            },
            status: 'ACTIVE'
        }
    });

    // Check expired VTV
    const expiredCount = await prisma.vehicle.count({
        where: {
            ...(orgId ? { organizationId: orgId } : {}),
            registrationExpiry: {
                lt: now
            },
            status: 'ACTIVE'
        }
    });

    return {
        expiring: expiringCount,
        expired: expiredCount
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a complete compliance summary for an organization
 * Used for dashboard widget
 * @param orgId Organization ID
 */
export async function getComplianceSummary(orgId: string): Promise<ComplianceSummary> {
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    // Driver's license checks
    const [licensesExpiring30Days, licensesExpiring7Days, licensesExpired, techniciansWithoutLicense] = await Promise.all([
        // Expiring in 30 days
        prisma.user.count({
            where: {
                organizationId: orgId,
                isActive: true,
                driverLicenseExpiry: {
                    gte: now,
                    lte: in30Days
                }
            }
        }),
        // Expiring in 7 days
        prisma.user.count({
            where: {
                organizationId: orgId,
                isActive: true,
                driverLicenseExpiry: {
                    gte: now,
                    lte: in7Days
                }
            }
        }),
        // Already expired
        prisma.user.count({
            where: {
                organizationId: orgId,
                isActive: true,
                driverLicenseExpiry: {
                    lt: now
                }
            }
        }),
        // Missing license but has vehicle assignment
        prisma.user.count({
            where: {
                organizationId: orgId,
                isActive: true,
                driverLicenseNumber: null,
                vehicleAssignments: {
                    some: {}
                }
            }
        })
    ]);

    // Vehicle checks
    const [vehicleInsurance, vtv] = await Promise.all([
        checkVehicleInsurance(orgId, 30),
        checkVehicleVTV(orgId, 30)
    ]);

    const totalIssues =
        licensesExpiring7Days +
        licensesExpired +
        techniciansWithoutLicense +
        vehicleInsurance.expired +
        vtv.expired;

    return {
        licensesExpiring30Days,
        licensesExpiring7Days,
        licensesExpired,
        techniciansWithoutLicense,
        vehicleInsuranceExpiring30Days: vehicleInsurance.expiring,
        vehicleInsuranceExpired: vehicleInsurance.expired,
        vtvExpiring30Days: vtv.expiring,
        totalIssues
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE ALERT LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log a compliance alert (for audit trail)
 */
export async function logComplianceAlert(
    orgId: string,
    alertType: 'license_expiring' | 'license_expired' | 'no_license' | 'insurance_expiring' | 'vtv_expiring' | 'vehicle_mismatch',
    userId: string | null,
    vehicleId: string | null,
    message: string,
    severity: 'info' | 'warning' | 'critical'
): Promise<void> {
    await prisma.subscriptionEvent.create({
        data: {
            organizationId: orgId,
            eventType: `compliance_${alertType}`,
            description: message,
            metadata: {
                userId,
                vehicleId,
                severity,
                alertedAt: new Date().toISOString()
            }
        }
    });
}
