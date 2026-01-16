/**
 * Dashboard Compliance Stats API
 * ==============================
 * 
 * Phase 5: Compliance Widget
 * 
 * GET /api/dashboard/compliance - Get compliance summary for dashboard widget
 * 
 * Returns counts of:
 * - Driver's licenses expiring/expired
 * - Technicians without license info
 * - Vehicle insurance status
 * - VTV (technical inspection) status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getComplianceSummary, checkExpiringLicenses, checkExpiredLicenses, checkMissingLicenses, checkVehicleInsurance } from '@/lib/services/compliance-check';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgId = session.organizationId;

        // Get the full compliance summary
        const summary = await getComplianceSummary(orgId);

        // Get detailed lists for certain categories (limited for performance)
        const [expiringLicenses, expiredLicenses, missingLicenses, vehicleInsurance] = await Promise.all([
            checkExpiringLicenses(orgId, 30),
            checkExpiredLicenses(orgId),
            checkMissingLicenses(orgId),
            checkVehicleInsurance(orgId, 30)
        ]);

        // Build detailed alerts for the widget
        const alerts: Array<{
            type: 'error' | 'warning' | 'info';
            category: string;
            message: string;
            count: number;
            action?: string;
        }> = [];

        // Critical: Expired licenses
        if (summary.licensesExpired > 0) {
            alerts.push({
                type: 'error',
                category: 'licenses',
                message: `${summary.licensesExpired} licencia(s) de conducir vencida(s)`,
                count: summary.licensesExpired,
                action: '/dashboard/team'
            });
        }

        // Warning: Expiring soon (7 days)
        if (summary.licensesExpiring7Days > 0) {
            alerts.push({
                type: 'warning',
                category: 'licenses',
                message: `${summary.licensesExpiring7Days} licencia(s) vence(n) en 7 días`,
                count: summary.licensesExpiring7Days,
                action: '/dashboard/team'
            });
        }

        // Warning: Missing licenses
        if (summary.techniciansWithoutLicense > 0) {
            alerts.push({
                type: 'warning',
                category: 'licenses',
                message: `${summary.techniciansWithoutLicense} conductor(es) sin licencia registrada`,
                count: summary.techniciansWithoutLicense,
                action: '/dashboard/team'
            });
        }

        // Critical: Expired insurance
        if (summary.vehicleInsuranceExpired > 0) {
            alerts.push({
                type: 'error',
                category: 'insurance',
                message: `${summary.vehicleInsuranceExpired} vehículo(s) con seguro vencido`,
                count: summary.vehicleInsuranceExpired,
                action: '/dashboard/fleet'
            });
        }

        // Warning: Expiring insurance
        if (summary.vehicleInsuranceExpiring30Days > 0) {
            alerts.push({
                type: 'warning',
                category: 'insurance',
                message: `${summary.vehicleInsuranceExpiring30Days} seguro(s) por vencer`,
                count: summary.vehicleInsuranceExpiring30Days,
                action: '/dashboard/fleet'
            });
        }

        // Warning: VTV expiring
        if (summary.vtvExpiring30Days > 0) {
            alerts.push({
                type: 'warning',
                category: 'vtv',
                message: `${summary.vtvExpiring30Days} VTV/revisación por vencer`,
                count: summary.vtvExpiring30Days,
                action: '/dashboard/fleet'
            });
        }

        // Sort alerts by severity (errors first, then warnings, then info)
        alerts.sort((a, b) => {
            const order = { error: 0, warning: 1, info: 2 };
            return order[a.type] - order[b.type];
        });

        return NextResponse.json({
            success: true,
            summary: {
                // License stats
                licensesExpiring30Days: summary.licensesExpiring30Days,
                licensesExpiring7Days: summary.licensesExpiring7Days,
                licensesExpired: summary.licensesExpired,
                techniciansWithoutLicense: summary.techniciansWithoutLicense,

                // Vehicle stats
                vehicleInsuranceExpiring: summary.vehicleInsuranceExpiring30Days,
                vehicleInsuranceExpired: summary.vehicleInsuranceExpired,
                vtvExpiring: summary.vtvExpiring30Days,

                // Totals
                totalIssues: summary.totalIssues,
                criticalIssues: summary.licensesExpired + summary.vehicleInsuranceExpired,
                warningIssues: summary.licensesExpiring7Days + summary.techniciansWithoutLicense + summary.vtvExpiring30Days
            },
            alerts,
            details: {
                expiringLicenses: expiringLicenses.slice(0, 5).map(l => ({
                    id: l.userId,
                    name: l.userName,
                    expiresAt: l.driverLicenseExpiry?.toISOString(),
                    daysUntil: l.daysUntilExpiry
                })),
                expiredLicenses: expiredLicenses.slice(0, 5).map(l => ({
                    id: l.userId,
                    name: l.userName,
                    expiredAt: l.driverLicenseExpiry?.toISOString()
                })),
                missingLicenses: missingLicenses.slice(0, 5).map(l => ({
                    id: l.userId,
                    name: l.userName
                })),
                vehicleInsurance: vehicleInsurance.vehicles.slice(0, 5).map(v => ({
                    id: v.id,
                    plateNumber: v.plateNumber,
                    status: v.status,
                    expiresAt: v.insuranceExpiry?.toISOString()
                }))
            },
            lastChecked: new Date().toISOString()
        });
    } catch (error) {
        console.error('[DashboardCompliance] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
