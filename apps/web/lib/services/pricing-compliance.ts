/**
 * Per-Visit Pricing Compliance Service
 * 
 * Phase 6 - January 2026
 * 
 * Validates business rules and ensures compliance with:
 * - Argentine Consumer Protection Law (Ley 24.240)
 * - AFIP immutability requirements for invoiced jobs
 * - Organization-specific pricing policies
 * 
 * This service acts as a guardrail for all pricing-related operations.
 */

import { Decimal } from '@prisma/client/runtime/library';
import {
    JobPricingMode,
    VisitWithPricing,
    validatePriceVariance,
    canChangePricingMode,
} from './pricing-calculator';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ComplianceResult {
    compliant: boolean;
    violations: ComplianceViolation[];
    warnings: ComplianceWarning[];
    requiresApproval: boolean;
    approvalType?: 'customer' | 'admin' | 'both';
}

export interface ComplianceViolation {
    code: string;
    field: string;
    message: string;
    severity: 'error' | 'blocking';
    lawReference?: string;
}

export interface ComplianceWarning {
    code: string;
    field: string;
    message: string;
}

export interface JobComplianceData {
    id: string;
    pricingMode: JobPricingMode;
    status: string;
    estimatedTotal: Decimal | null;
    finalTotal: Decimal | null;
    invoiceId: string | null;
    visits: VisitWithPricing[];
}

export interface PricingModeChangeRequest {
    currentMode: JobPricingMode;
    newMode: JobPricingMode;
    visits: VisitWithPricing[];
}

export interface VisitPriceUpdateRequest {
    visitId: string;
    estimatedPrice: Decimal | null;
    proposedActualPrice: number;
    priceVarianceReason?: string;
}

export interface OrganizationPricingPolicy {
    techMaxAdjustmentPercent: number;  // Default: 10 per Argentine law
    requireApprovalForAllPriceChanges: boolean;
    allowTechPriceReduction: boolean;
    requireVarianceReason: boolean;
}

// Default policy aligned with Argentine consumer protection
const DEFAULT_PRICING_POLICY: OrganizationPricingPolicy = {
    techMaxAdjustmentPercent: 10,  // Ley 24.240
    requireApprovalForAllPriceChanges: false,
    allowTechPriceReduction: true,
    requireVarianceReason: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE CODES
// ═══════════════════════════════════════════════════════════════════════════════

export const COMPLIANCE_CODES = {
    // Argentine Law Violations
    PRICE_VARIANCE_EXCEEDED: 'LEY24240_PRICE_VARIANCE',
    PRICE_INCREASE_NO_CONSENT: 'LEY24240_NO_CONSENT',

    // Business Rule Violations
    MODE_CHANGE_AFTER_WORK: 'BIZ_MODE_CHANGE_LOCKED',
    INVOICED_JOB_MODIFICATION: 'BIZ_INVOICED_READONLY',
    MISSING_VARIANCE_REASON: 'BIZ_MISSING_REASON',
    TERMINAL_STATE_MODIFICATION: 'BIZ_TERMINAL_STATE', // Phase 10 Security

    // Data Integrity Warnings
    NEGATIVE_PRICE: 'DATA_NEGATIVE_PRICE',
    ZERO_PRICE_COMPLETED: 'DATA_ZERO_COMPLETED',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate if pricing mode can be changed for a job
 * Business Rule: Cannot change after first visit is completed
 */
export function validatePricingModeChange(
    request: PricingModeChangeRequest
): ComplianceResult {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    // Check if any visit is completed
    if (!canChangePricingMode(request.visits)) {
        violations.push({
            code: COMPLIANCE_CODES.MODE_CHANGE_AFTER_WORK,
            field: 'pricingMode',
            message: 'No se puede cambiar el modo de tarificación después de completar una visita.',
            severity: 'blocking',
        });
    }

    return {
        compliant: violations.length === 0,
        violations,
        warnings,
        requiresApproval: false,
    };
}

/**
 * Validate a proposed visit price update
 * Argentine Consumer Protection: >10% increase requires explicit consent
 */
export function validateVisitPriceUpdate(
    request: VisitPriceUpdateRequest,
    policy: OrganizationPricingPolicy = DEFAULT_PRICING_POLICY
): ComplianceResult {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];
    let requiresApproval = false;
    let approvalType: 'customer' | 'admin' | 'both' | undefined;

    // Validate negative prices
    if (request.proposedActualPrice < 0) {
        violations.push({
            code: COMPLIANCE_CODES.NEGATIVE_PRICE,
            field: 'actualPrice',
            message: 'El precio no puede ser negativo.',
            severity: 'error',
        });
    }

    // Check price variance against Argentine consumer law
    const varianceResult = validatePriceVariance(
        request.estimatedPrice,
        request.proposedActualPrice,
        policy.techMaxAdjustmentPercent
    );

    if (!varianceResult.valid && varianceResult.requiresApproval) {
        // This is a blocking violation per Argentine law
        violations.push({
            code: COMPLIANCE_CODES.PRICE_VARIANCE_EXCEEDED,
            field: 'actualPrice',
            message: varianceResult.message || `El precio supera el ${policy.techMaxAdjustmentPercent}% del estimado.`,
            severity: 'blocking',
            lawReference: 'Ley 24.240 - Defensa del Consumidor',
        });
        requiresApproval = true;
        approvalType = 'customer';
    }

    // Check if variance reason is required but missing
    if (varianceResult.variancePercent &&
        varianceResult.variancePercent !== 0 &&
        policy.requireVarianceReason &&
        !request.priceVarianceReason) {
        violations.push({
            code: COMPLIANCE_CODES.MISSING_VARIANCE_REASON,
            field: 'priceVarianceReason',
            message: 'Se requiere una justificación para el cambio de precio.',
            severity: 'error',
        });
    }

    // Warning for price reductions (allowed but logged)
    if (varianceResult.variancePercent && varianceResult.variancePercent < 0) {
        warnings.push({
            code: 'INFO_PRICE_REDUCTION',
            field: 'actualPrice',
            message: `Precio reducido en ${Math.abs(varianceResult.variancePercent)}%`,
        });
    }

    return {
        compliant: violations.filter(v => v.severity === 'error' || v.severity === 'blocking').length === 0,
        violations,
        warnings,
        requiresApproval,
        approvalType,
    };
}

/**
 * Validate if a job can be modified (not invoiced/locked)
 * AFIP Compliance: Invoiced jobs are immutable
 * Phase 10 Security: Terminal state jobs are immutable
 */
export function validateJobModification(job: JobComplianceData): ComplianceResult {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];

    // Check if job is invoiced (AFIP immutability)
    if (job.invoiceId) {
        violations.push({
            code: COMPLIANCE_CODES.INVOICED_JOB_MODIFICATION,
            field: 'job',
            message: 'No se puede modificar un trabajo facturado. Los datos fiscales son inmutables.',
            severity: 'blocking',
            lawReference: 'AFIP - Resolución General',
        });
    }

    // Phase 10 Security: Block modifications to terminal state jobs
    const TERMINAL_STATES = ['COMPLETED', 'CANCELLED'];
    if (TERMINAL_STATES.includes(job.status)) {
        const statusText = job.status === 'COMPLETED' ? 'completado' : 'cancelado';
        violations.push({
            code: COMPLIANCE_CODES.TERMINAL_STATE_MODIFICATION,
            field: 'status',
            message: `No se puede modificar un trabajo ${statusText}. Los trabajos terminados son inmutables.`,
            severity: 'blocking',
        });
        console.warn('[SECURITY] Pricing compliance terminal state violation:', {
            jobId: job.id,
            currentStatus: job.status,
            timestamp: new Date().toISOString(),
        });
    }

    return {
        compliant: violations.length === 0,
        violations,
        warnings,
        requiresApproval: false,
    };
}

/**
 * Full compliance check for visit pricing operations
 * Combines all relevant validations
 */
export function validateFullPricingCompliance(
    job: JobComplianceData,
    priceUpdate: VisitPriceUpdateRequest,
    policy: OrganizationPricingPolicy = DEFAULT_PRICING_POLICY
): ComplianceResult {
    // First check if job can be modified at all
    const modificationResult = validateJobModification(job);
    if (!modificationResult.compliant) {
        return modificationResult;
    }

    // Then check the specific price update
    const priceResult = validateVisitPriceUpdate(priceUpdate, policy);

    // Merge results
    return {
        compliant: modificationResult.compliant && priceResult.compliant,
        violations: [...modificationResult.violations, ...priceResult.violations],
        warnings: [...modificationResult.warnings, ...priceResult.warnings],
        requiresApproval: modificationResult.requiresApproval || priceResult.requiresApproval,
        approvalType: priceResult.approvalType || modificationResult.approvalType,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL WORKFLOW HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApprovalRequest {
    type: 'price_variance';
    jobId: string;
    visitId: string;
    originalPrice: number;
    proposedPrice: number;
    variancePercent: number;
    reason: string;
    requestedBy: string;
    requestedAt: Date;
}

/**
 * Create approval request for price variance exceeding threshold
 */
export function createApprovalRequest(
    jobId: string,
    visitId: string,
    originalPrice: number,
    proposedPrice: number,
    reason: string,
    requestedBy: string
): ApprovalRequest {
    const variancePercent = originalPrice > 0
        ? Math.round(((proposedPrice - originalPrice) / originalPrice) * 100)
        : 0;

    return {
        type: 'price_variance',
        jobId,
        visitId,
        originalPrice,
        proposedPrice,
        variancePercent,
        reason,
        requestedBy,
        requestedAt: new Date(),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE VISIT BREAKDOWN (for per-visit mode)
// ═══════════════════════════════════════════════════════════════════════════════

export interface InvoiceVisitLineItem {
    visitNumber: number;
    description: string;
    scheduledDate: Date;
    quantity: number;
    unitPrice: number;
    total: number;
    isInitialVisit?: boolean;
}

/**
 * Generate invoice line items from visits for per-visit pricing mode
 * Used by invoice generation to show visit breakdown
 */
export function generateInvoiceVisitItems(
    visits: VisitWithPricing[],
    pricingMode: JobPricingMode,
    serviceDescription: string = 'Servicio técnico'
): InvoiceVisitLineItem[] {
    if (pricingMode === 'FIXED_TOTAL') {
        // FIXED_TOTAL doesn't break down by visit
        return [];
    }

    return visits
        .filter(visit => visit.status === 'COMPLETED')
        .map((visit, index) => {
            const isInitialVisit = index === 0;
            const price = visit.actualPrice
                ? Number(visit.actualPrice)
                : visit.estimatedPrice
                    ? Number(visit.estimatedPrice)
                    : 0;

            let description = `${serviceDescription} - Visita ${visit.visitNumber}`;
            if (pricingMode === 'HYBRID' && isInitialVisit) {
                description = `${serviceDescription} - Diagnóstico inicial`;
            }

            return {
                visitNumber: visit.visitNumber,
                description,
                scheduledDate: visit.scheduledDate,
                quantity: 1,
                unitPrice: price,
                total: price,
                isInitialVisit,
            };
        });
}

/**
 * Calculate invoice totals from visit items
 */
export function calculateInvoiceTotals(
    items: InvoiceVisitLineItem[],
    taxRate: number = 0.21  // 21% IVA Argentina
): { subtotal: number; tax: number; total: number } {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    return { subtotal, tax, total };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

export interface PricingAuditEntry {
    timestamp: Date;
    action: 'price_update' | 'mode_change' | 'approval_request' | 'approval_granted' | 'approval_denied';
    jobId: string;
    visitId?: string;
    userId: string;
    previousValue?: string | number;
    newValue?: string | number;
    reason?: string;
    complianceResult?: ComplianceResult;
}

/**
 * Create audit entry for pricing operations (for logging purposes)
 */
export function createPricingAuditEntry(
    action: PricingAuditEntry['action'],
    jobId: string,
    userId: string,
    details: Partial<Omit<PricingAuditEntry, 'timestamp' | 'action' | 'jobId' | 'userId'>>
): PricingAuditEntry {
    return {
        timestamp: new Date(),
        action,
        jobId,
        userId,
        ...details,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get human-readable message for compliance violation
 */
export function getViolationDisplayMessage(violation: ComplianceViolation): string {
    const lawNote = violation.lawReference
        ? ` (Ref: ${violation.lawReference})`
        : '';
    return `${violation.message}${lawNote}`;
}

/**
 * Check if result has any blocking violations
 */
export function hasBlockingViolations(result: ComplianceResult): boolean {
    return result.violations.some(v => v.severity === 'blocking');
}

/**
 * Get all error messages from compliance result
 */
export function getComplianceErrors(result: ComplianceResult): string[] {
    return result.violations.map(v => getViolationDisplayMessage(v));
}
