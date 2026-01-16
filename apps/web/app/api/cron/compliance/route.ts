/**
 * Compliance Cron Endpoint
 * ========================
 * 
 * Phase 5: Compliance Alerts
 * 
 * POST /api/cron/compliance - Run compliance checks
 * GET /api/cron/compliance - Get compliance status
 * 
 * Schedule: Daily at 8:00 AM Buenos Aires time (11:00 UTC)
 * 
 * Checks:
 * - Driver's license expiry (30, 14, 7, 1 days warnings)
 * - Expired driver's licenses
 * - Vehicle-driver assignment mismatches
 * - Vehicle insurance expiry
 * - VTV (Verificación Técnica Vehicular) expiry
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    checkExpiringLicenses,
    checkExpiredLicenses,
    checkMissingLicenses,
    checkVehicleDriverMismatches,
    checkVehicleInsurance,
    checkVehicleVTV,
    getComplianceSummary,
    logComplianceAlert,
} from '@/lib/services/compliance-check';

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max

interface CronJobResult {
    success: boolean;
    processed: number;
    alertsSent: number;
    errors: Array<{ id: string; error: string }>;
    durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Run Compliance Checks
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];
    let processed = 0;
    let alertsSent = 0;

    console.log('[ComplianceCron] Starting compliance checks...');

    try {
        // Verify cron secret if configured
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
            const authHeader = request.headers.get('authorization');
            if (authHeader !== `Bearer ${cronSecret}`) {
                console.warn('[ComplianceCron] Unauthorized request');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        // Get all active organizations
        const organizations = await prisma.organization.findMany({
            where: {
                subscriptionStatus: { in: ['active', 'trialing'] }
            },
            select: {
                id: true,
                name: true,
                ownerId: true
            }
        });

        console.log(`[ComplianceCron] Checking ${organizations.length} organizations`);

        const reminderDays = [30, 14, 7, 1];

        for (const org of organizations) {
            try {
                processed++;

                // Check driver's licenses
                for (const days of reminderDays) {
                    const expiringLicenses = await checkExpiringLicenses(org.id, days);

                    for (const license of expiringLicenses) {
                        // Only send alert for the specific day threshold
                        if (license.daysUntilExpiry === days) {
                            await logComplianceAlert(
                                org.id,
                                'license_expiring',
                                license.userId,
                                null,
                                `Licencia de conducir de ${license.userName} vence en ${days} días`,
                                days <= 7 ? 'warning' : 'info'
                            );
                            alertsSent++;
                        }
                    }
                }

                // Check expired licenses
                const expiredLicenses = await checkExpiredLicenses(org.id);
                for (const license of expiredLicenses) {
                    await logComplianceAlert(
                        org.id,
                        'license_expired',
                        license.userId,
                        null,
                        `Licencia de conducir de ${license.userName} está vencida`,
                        'critical'
                    );
                    alertsSent++;
                }

                // Check missing licenses (drivers without license info)
                const missingLicenses = await checkMissingLicenses(org.id);
                for (const user of missingLicenses) {
                    await logComplianceAlert(
                        org.id,
                        'no_license',
                        user.userId,
                        null,
                        `${user.userName} tiene vehículo asignado pero no tiene licencia de conducir registrada`,
                        'warning'
                    );
                    alertsSent++;
                }

                // Check vehicle-driver mismatches for upcoming jobs
                const mismatches = await checkVehicleDriverMismatches(org.id, 7);
                for (const mismatch of mismatches) {
                    await logComplianceAlert(
                        org.id,
                        'vehicle_mismatch',
                        mismatch.technicianId,
                        null,
                        mismatch.message,
                        'warning'
                    );
                    alertsSent++;
                }

                // Check vehicle insurance
                const insurance = await checkVehicleInsurance(org.id, 30);
                for (const vehicle of insurance.vehicles) {
                    await logComplianceAlert(
                        org.id,
                        'insurance_expiring',
                        null,
                        vehicle.id,
                        `Seguro del vehículo ${vehicle.plateNumber || 'N/A'} ${vehicle.status === 'expired' ? 'está vencido' : 'vence pronto'}`,
                        vehicle.status === 'expired' ? 'critical' : 'warning'
                    );
                    alertsSent++;
                }

                // Check VTV
                const vtv = await checkVehicleVTV(org.id, 30);
                if (vtv.expired > 0 || vtv.expiring > 0) {
                    await logComplianceAlert(
                        org.id,
                        'vtv_expiring',
                        null,
                        null,
                        `${vtv.expired} vehículos con VTV vencida, ${vtv.expiring} por vencer`,
                        vtv.expired > 0 ? 'critical' : 'warning'
                    );
                    alertsSent++;
                }

                console.log(`[ComplianceCron] Processed ${org.name}, alerts: ${alertsSent}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`[ComplianceCron] Error processing org ${org.id}:`, error);
                errors.push({ id: org.id, error: errorMessage });
            }
        }

        const result: CronJobResult = {
            success: errors.length === 0,
            processed,
            alertsSent,
            errors,
            durationMs: Date.now() - startTime
        };

        // Log the cron execution
        await prisma.subscriptionEvent.create({
            data: {
                organizationId: 'system',
                eventType: 'cron_compliance_check',
                description: `Compliance check completed: ${processed} orgs, ${alertsSent} alerts`,
                metadata: result
            }
        });

        console.log(`[ComplianceCron] Complete. Processed: ${processed}, Alerts: ${alertsSent}, Errors: ${errors.length}`);

        return NextResponse.json(result);
    } catch (error) {
        console.error('[ComplianceCron] Fatal error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs: Date.now() - startTime
            },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Compliance Status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        // Get orgId from query params (optional)
        const orgId = request.nextUrl.searchParams.get('orgId');

        if (orgId) {
            // Return summary for specific organization
            const summary = await getComplianceSummary(orgId);

            return NextResponse.json({
                success: true,
                organizationId: orgId,
                summary,
                needsAttention: summary.totalIssues > 0,
                checkedAt: new Date().toISOString()
            });
        }

        // Return overall status
        const lastRun = await prisma.subscriptionEvent.findFirst({
            where: {
                organizationId: 'system',
                eventType: 'cron_compliance_check'
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true, metadata: true }
        });

        // Get counts across all orgs
        const now = new Date();
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);

        const [expiredLicenses, expiringLicenses, missingLicenses] = await Promise.all([
            prisma.user.count({
                where: {
                    isActive: true,
                    driverLicenseExpiry: { lt: now }
                }
            }),
            prisma.user.count({
                where: {
                    isActive: true,
                    driverLicenseExpiry: { gte: now, lte: in30Days }
                }
            }),
            prisma.user.count({
                where: {
                    isActive: true,
                    driverLicenseNumber: null,
                    vehicleAssignments: { some: {} }
                }
            })
        ]);

        return NextResponse.json({
            success: true,
            status: {
                expiredLicenses,
                expiringLicenses,
                driversWithoutLicense: missingLicenses,
                lastRun: lastRun?.createdAt?.toISOString() || null,
                lastRunResult: lastRun?.metadata || null
            },
            needsAttention: expiredLicenses > 0 || missingLicenses > 0
        });
    } catch (error) {
        console.error('[ComplianceCron] Status check error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
