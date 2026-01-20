/**
 * Per-Visit Pricing Calculator Service
 * 
 * Phase 1 - January 2026
 * 
 * Calculates job totals based on pricing mode:
 * - FIXED_TOTAL: One price for entire job (current behavior)
 * - PER_VISIT: Each visit priced separately
 * - HYBRID: First visit different (diagnostic), then recurring rate
 * 
 * Respects the "Budgetary Isolation" pattern for Argentine field service.
 */

import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// Re-define types locally to avoid monorepo Prisma client resolution issues
// ═══════════════════════════════════════════════════════════════════════════════

export type JobPricingMode = 'FIXED_TOTAL' | 'PER_VISIT' | 'HYBRID';
export type JobStatus = 'PENDING' | 'ASSIGNED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VisitWithPricing {
    id: string;
    visitNumber: number;
    scheduledDate: Date;
    status: JobStatus;
    estimatedPrice: Decimal | null;
    actualPrice: Decimal | null;
    techProposedPrice: Decimal | null;
    priceVarianceReason: string | null;
    requiresDeposit: boolean;
    depositAmount: Decimal | null;
    depositPaidAt: Date | null;
}

export interface JobWithPricing {
    id: string;
    pricingMode: JobPricingMode;
    estimatedTotal: Decimal | null;
    defaultVisitRate: Decimal | null;
    visits: VisitWithPricing[];
}

export interface VisitBreakdownItem {
    visitNumber: number;
    scheduledDate: Date;
    price: number | null;
    status: JobStatus;
    isInitialVisit?: boolean;
}

export interface PricingCalculation {
    subtotal: number;
    visitBreakdown: VisitBreakdownItem[] | null;
    mode: JobPricingMode;
    depositTotal: number;
    balanceDue: number;
    completedVisitsTotal: number;
    pendingVisitsTotal: number;
}

export interface PriceVarianceValidation {
    valid: boolean;
    requiresApproval?: boolean;
    message?: string;
    variancePercent?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert Decimal to number safely
 */
function toNumber(value: Decimal | null | undefined): number {
    if (!value) return 0;
    return Number(value);
}

/**
 * Get the effective price for a visit (actual → estimated → default rate)
 */
function getVisitEffectivePrice(
    visit: VisitWithPricing,
    defaultRate: Decimal | null,
    isFirstVisit: boolean,
    mode: JobPricingMode
): number {
    // Always prefer actual price if set
    if (visit.actualPrice) {
        return toNumber(visit.actualPrice);
    }

    // Then estimated price
    if (visit.estimatedPrice) {
        return toNumber(visit.estimatedPrice);
    }

    // For HYBRID mode, only subsequent visits use default rate
    if (mode === 'HYBRID' && !isFirstVisit && defaultRate) {
        return toNumber(defaultRate);
    }

    // For PER_VISIT mode, use default rate if no specific price
    if (mode === 'PER_VISIT' && defaultRate) {
        return toNumber(defaultRate);
    }

    return 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CALCULATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate job totals based on pricing mode
 * Respects the "Budgetary Isolation" pattern for Argentine field service
 */
export function calculateJobTotal(job: JobWithPricing): PricingCalculation {
    const { pricingMode, visits, estimatedTotal, defaultVisitRate } = job;

    // Calculate deposit totals across all visits
    const depositTotal = visits.reduce((sum, visit) => {
        if (visit.depositPaidAt && visit.depositAmount) {
            return sum + toNumber(visit.depositAmount);
        }
        return sum;
    }, 0);

    switch (pricingMode) {
        case 'FIXED_TOTAL': {
            // Current behavior: use job.estimatedTotal
            const subtotal = toNumber(estimatedTotal);
            return {
                subtotal,
                visitBreakdown: null,
                mode: 'FIXED_TOTAL',
                depositTotal,
                balanceDue: subtotal - depositTotal,
                completedVisitsTotal: 0,
                pendingVisitsTotal: 0,
            };
        }

        case 'PER_VISIT': {
            // Sum all visit prices
            let completedTotal = 0;
            let pendingTotal = 0;

            const visitBreakdown: VisitBreakdownItem[] = visits.map((visit) => {
                const price = getVisitEffectivePrice(visit, defaultVisitRate, false, 'PER_VISIT');

                if (visit.status === 'COMPLETED') {
                    completedTotal += price;
                } else {
                    pendingTotal += price;
                }

                return {
                    visitNumber: visit.visitNumber,
                    scheduledDate: visit.scheduledDate,
                    price,
                    status: visit.status,
                };
            });

            const subtotal = completedTotal + pendingTotal;

            return {
                subtotal,
                visitBreakdown,
                mode: 'PER_VISIT',
                depositTotal,
                balanceDue: subtotal - depositTotal,
                completedVisitsTotal: completedTotal,
                pendingVisitsTotal: pendingTotal,
            };
        }

        case 'HYBRID': {
            // First visit at custom rate (diagnostic), rest at default rate
            let completedTotal = 0;
            let pendingTotal = 0;

            const visitBreakdown: VisitBreakdownItem[] = visits.map((visit, index) => {
                const isInitialVisit = index === 0;
                const price = getVisitEffectivePrice(visit, defaultVisitRate, isInitialVisit, 'HYBRID');

                if (visit.status === 'COMPLETED') {
                    completedTotal += price;
                } else {
                    pendingTotal += price;
                }

                return {
                    visitNumber: visit.visitNumber,
                    scheduledDate: visit.scheduledDate,
                    price,
                    status: visit.status,
                    isInitialVisit,
                };
            });

            const subtotal = completedTotal + pendingTotal;

            return {
                subtotal,
                visitBreakdown,
                mode: 'HYBRID',
                depositTotal,
                balanceDue: subtotal - depositTotal,
                completedVisitsTotal: completedTotal,
                pendingVisitsTotal: pendingTotal,
            };
        }

        default: {
            // Fallback to FIXED_TOTAL behavior
            const subtotal = toNumber(estimatedTotal);
            return {
                subtotal,
                visitBreakdown: null,
                mode: 'FIXED_TOTAL',
                depositTotal,
                balanceDue: subtotal - depositTotal,
                completedVisitsTotal: 0,
                pendingVisitsTotal: 0,
            };
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate price variance on visit completion
 * Argentine consumer law (Ley 24.240): >10% increase requires explicit consent
 */
export function validatePriceVariance(
    estimatedPrice: Decimal | null,
    proposedPrice: number,
    maxVariancePercent: number = 10
): PriceVarianceValidation {
    if (!estimatedPrice) {
        // No estimated price to compare against
        return { valid: true };
    }

    const estimated = toNumber(estimatedPrice);
    if (estimated === 0) {
        return { valid: true };
    }

    const variance = (proposedPrice - estimated) / estimated;
    const variancePercent = Math.round(variance * 100);

    // Only flag increases, decreases are always allowed
    if (variance > maxVariancePercent / 100) {
        return {
            valid: false,
            requiresApproval: true,
            message: `El precio supera el ${maxVariancePercent}% del estimado. Requiere aprobación.`,
            variancePercent,
        };
    }

    return { valid: true, variancePercent };
}

/**
 * Check if pricing mode can be changed for a job
 * Cannot change after first visit is completed (immutability rule)
 */
export function canChangePricingMode(visits: VisitWithPricing[]): boolean {
    return !visits.some(visit => visit.status === 'COMPLETED');
}

/**
 * Calculate the sum of all visit estimated prices
 * Used to sync job.estimatedTotal when in per-visit mode
 */
export function calculateVisitsTotalEstimate(visits: VisitWithPricing[]): number {
    return visits.reduce((sum, visit) => sum + toNumber(visit.estimatedPrice), 0);
}

/**
 * Calculate the sum of all visit actual prices
 * Used for final invoicing in per-visit mode
 */
export function calculateVisitsTotalActual(visits: VisitWithPricing[]): number {
    return visits.reduce((sum, visit) => sum + toNumber(visit.actualPrice), 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTING UTILITIES (for Argentine peso display)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format price as Argentine peso string
 */
export function formatPriceARS(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) {
        return '-';
    }
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Get pricing mode display label in Spanish
 */
export function getPricingModeLabel(mode: JobPricingMode): string {
    switch (mode) {
        case 'FIXED_TOTAL':
            return 'Precio cerrado';
        case 'PER_VISIT':
            return 'Por visita';
        case 'HYBRID':
            return 'Híbrido';
        default:
            return 'Desconocido';
    }
}

/**
 * Get pricing mode description in Spanish
 */
export function getPricingModeDescription(mode: JobPricingMode): string {
    switch (mode) {
        case 'FIXED_TOTAL':
            return 'Un total para todo el trabajo';
        case 'PER_VISIT':
            return 'Cada visita tiene su precio';
        case 'HYBRID':
            return 'Diagnóstico inicial + tarifa recurrente';
        default:
            return '';
    }
}
