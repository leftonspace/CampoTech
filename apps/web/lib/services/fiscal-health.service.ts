/**
 * Fiscal Health Service
 * =====================
 *
 * Phase 2.4 Task 2.4.2: Fiscal Health Dashboard Service
 *
 * Provides fiscal health monitoring for Argentine Monotributistas.
 * Calculates YTD billing and compares against Monotributo category limits.
 *
 * Uses "traffic light" indicators:
 * - GREEN (< 70%): Healthy - within normal limits
 * - YELLOW (70-90%): Approaching limit - plan ahead
 * - RED (> 90%): At risk - consult accountant
 */

import { prisma } from '@/lib/prisma';
import {
    MONOTRIBUTO_CATEGORIES,
    MonotributoCategoryKey,
    isValidMonotributoCategory,
    formatARS,
    suggestNextCategory,
} from '@/lib/constants/monotributo-categories';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type FiscalHealthStatus = 'green' | 'yellow' | 'red';

export interface FiscalHealthResult {
    category: MonotributoCategoryKey;
    categoryName: string;
    ytdBilling: number;
    annualLimit: number;
    monthlyLimit: number;
    percentUsed: number;
    remainingAmount: number;
    remainingMonthly: number;
    status: FiscalHealthStatus;
    statusLabel: string;
    recommendation: string;
    suggestedCategory: MonotributoCategoryKey | null;
    lastInvoiceDate: Date | null;
    invoiceCount: number;
    averageMonthlyBilling: number;
    projectedAnnual: number;
    projectedStatus: FiscalHealthStatus;
}

export interface FiscalHealthSummary {
    status: FiscalHealthStatus;
    percentUsed: number;
    remainingAmount: number;
    categoryName: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class FiscalHealthService {
    /**
     * Calculate complete fiscal health for an organization
     */
    async calculateFiscalHealth(orgId: string): Promise<FiscalHealthResult> {
        // 1. Get organization and its Monotributo category from settings
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { settings: true },
        });

        const settings = (org?.settings as Record<string, unknown>) || {};
        const categoryKey = settings.monotributoCategory as string || 'A';

        // Validate category
        const category: MonotributoCategoryKey = isValidMonotributoCategory(categoryKey)
            ? categoryKey
            : 'A';

        const limits = MONOTRIBUTO_CATEGORIES[category];

        // 2. Get YTD billing from AFIP CAE-issued invoices
        const ytdData = await this.getYTDBillingData(orgId);

        // 3. Calculate fiscal health metrics
        const percentUsed = limits.maxAnnual > 0
            ? (ytdData.ytdTotal / limits.maxAnnual) * 100
            : 0;
        const remainingAmount = Math.max(0, limits.maxAnnual - ytdData.ytdTotal);

        // Calculate remaining monthly budget
        const currentMonth = new Date().getMonth();
        const remainingMonths = 12 - currentMonth;
        const remainingMonthly = remainingMonths > 0 ? remainingAmount / remainingMonths : 0;

        // 4. Calculate projections
        const monthsElapsed = currentMonth + 1;
        const averageMonthlyBilling = monthsElapsed > 0 ? ytdData.ytdTotal / monthsElapsed : 0;
        const projectedAnnual = averageMonthlyBilling * 12;
        const projectedPercent = limits.maxAnnual > 0 ? (projectedAnnual / limits.maxAnnual) * 100 : 0;

        // 5. Determine status
        const status = this.getTrafficLightStatus(percentUsed);
        const projectedStatus = this.getTrafficLightStatus(projectedPercent);

        // 6. Get recommendation
        const recommendation = this.getComplianceRecommendation(percentUsed, category);

        // 7. Suggest next category if approaching limit
        const suggestedCategory = suggestNextCategory(category, ytdData.ytdTotal);

        return {
            category,
            categoryName: limits.name,
            ytdBilling: ytdData.ytdTotal,
            annualLimit: limits.maxAnnual,
            monthlyLimit: limits.maxMonthly,
            percentUsed: Math.round(percentUsed * 100) / 100,
            remainingAmount,
            remainingMonthly: Math.round(remainingMonthly),
            status,
            statusLabel: this.getStatusLabel(status),
            recommendation,
            suggestedCategory,
            lastInvoiceDate: ytdData.lastInvoiceDate,
            invoiceCount: ytdData.invoiceCount,
            averageMonthlyBilling: Math.round(averageMonthlyBilling),
            projectedAnnual: Math.round(projectedAnnual),
            projectedStatus,
        };
    }

    /**
     * Get simplified fiscal health summary (for mobile/widgets)
     */
    async getFiscalHealthSummary(orgId: string): Promise<FiscalHealthSummary> {
        const health = await this.calculateFiscalHealth(orgId);

        return {
            status: health.status,
            percentUsed: health.percentUsed,
            remainingAmount: health.remainingAmount,
            categoryName: health.categoryName,
        };
    }

    /**
     * Get YTD billing data from AFIP CAE-issued invoices
     */
    private async getYTDBillingData(orgId: string): Promise<{
        ytdTotal: number;
        invoiceCount: number;
        lastInvoiceDate: Date | null;
    }> {
        // Get start of current year
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

        // Query invoices with CAE (AFIP-issued) for this year
        const invoices = await prisma.invoice.aggregate({
            where: {
                organizationId: orgId,
                afipCae: { not: null }, // Only CAE-issued invoices count
                issuedAt: {
                    gte: yearStart,
                    lte: yearEnd,
                },
                status: { in: ['SENT', 'PAID'] }, // Only active invoices
            },
            _sum: { total: true },
            _count: true,
            _max: { issuedAt: true },
        });

        return {
            ytdTotal: Number(invoices._sum.total || 0),
            invoiceCount: invoices._count,
            lastInvoiceDate: invoices._max.issuedAt,
        };
    }

    /**
     * Determine traffic light status based on percentage used
     */
    private getTrafficLightStatus(percent: number): FiscalHealthStatus {
        if (percent < 70) return 'green';   // Healthy
        if (percent < 90) return 'yellow';  // Approaching limit
        return 'red';                        // At risk
    }

    /**
     * Get human-readable status label
     */
    private getStatusLabel(status: FiscalHealthStatus): string {
        switch (status) {
            case 'green':
                return 'Saludable';
            case 'yellow':
                return 'Acercándose al límite';
            case 'red':
                return 'En riesgo';
        }
    }

    /**
     * Get compliance-focused recommendation
     */
    private getComplianceRecommendation(percent: number, category: MonotributoCategoryKey): string {
        if (percent >= 90) {
            return 'Te recomendamos consultar con tu contador sobre la recategorización para mantener tu cumplimiento fiscal.';
        }
        if (percent >= 70) {
            return 'Estás acercándote al límite de tu categoría. Planificá con tu contador los próximos pasos.';
        }
        return 'Tu facturación está dentro de los límites saludables de tu categoría.';
    }

    /**
     * Get formatted fiscal health for display
     */
    async getFormattedFiscalHealth(orgId: string): Promise<{
        health: FiscalHealthResult;
        formatted: {
            ytdBilling: string;
            annualLimit: string;
            remainingAmount: string;
            remainingMonthly: string;
            averageMonthly: string;
            projectedAnnual: string;
        };
    }> {
        const health = await this.calculateFiscalHealth(orgId);

        return {
            health,
            formatted: {
                ytdBilling: formatARS(health.ytdBilling),
                annualLimit: formatARS(health.annualLimit),
                remainingAmount: formatARS(health.remainingAmount),
                remainingMonthly: formatARS(health.remainingMonthly),
                averageMonthly: formatARS(health.averageMonthlyBilling),
                projectedAnnual: formatARS(health.projectedAnnual),
            },
        };
    }
}

// Export singleton instance
export const fiscalHealthService = new FiscalHealthService();
