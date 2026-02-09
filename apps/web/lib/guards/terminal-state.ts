/**
 * Terminal State Guards
 * =====================
 * 
 * Phase 10 Security Remediation
 * 
 * Centralized terminal state validation for jobs, invoices, and payments.
 * These guards prevent modification of records that have reached a terminal
 * state (COMPLETED, CANCELLED, REFUNDED, etc.)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TERMINAL STATE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const TERMINAL_JOB_STATES = ['COMPLETED', 'CANCELLED'] as const;
export const TERMINAL_PAYMENT_STATES = ['COMPLETED', 'REFUNDED'] as const;
export const TERMINAL_INVOICE_STATES = ['AUTHORIZED', 'VOIDED'] as const;

export type TerminalJobState = (typeof TERMINAL_JOB_STATES)[number];
export type TerminalPaymentState = (typeof TERMINAL_PAYMENT_STATES)[number];
export type TerminalInvoiceState = (typeof TERMINAL_INVOICE_STATES)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a job status is terminal (COMPLETED or CANCELLED)
 */
export function isJobTerminal(status: string): boolean {
    return TERMINAL_JOB_STATES.includes(status as TerminalJobState);
}

/**
 * Check if a payment status is terminal (COMPLETED or REFUNDED)
 */
export function isPaymentTerminal(status: string): boolean {
    return TERMINAL_PAYMENT_STATES.includes(status as TerminalPaymentState);
}

/**
 * Check if an invoice status is terminal (AUTHORIZED or VOIDED)
 */
export function isInvoiceTerminal(status: string): boolean {
    return TERMINAL_INVOICE_STATES.includes(status as TerminalInvoiceState);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSERTION FUNCTIONS (throw on terminal state)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error thrown when attempting to modify a record in terminal state
 */
export class TerminalStateError extends Error {
    public readonly entityType: 'job' | 'payment' | 'invoice';
    public readonly status: string;
    public readonly entityId?: string;

    constructor(
        entityType: 'job' | 'payment' | 'invoice',
        status: string,
        entityId?: string
    ) {
        const messages: Record<string, string> = {
            'COMPLETED': 'completado',
            'CANCELLED': 'cancelado',
            'REFUNDED': 'reembolsado',
            'AUTHORIZED': 'autorizada',
            'VOIDED': 'anulada',
        };
        const statusText = messages[status] || status.toLowerCase();

        const entityNames: Record<string, string> = {
            'job': 'trabajo',
            'payment': 'pago',
            'invoice': 'factura',
        };
        const entityName = entityNames[entityType] || entityType;

        super(`No se puede modificar un ${entityName} ${statusText}`);
        this.name = 'TerminalStateError';
        this.entityType = entityType;
        this.status = status;
        this.entityId = entityId;
    }
}

/**
 * Assert that a job is not in a terminal state
 * @throws {TerminalStateError} if job is COMPLETED or CANCELLED
 */
export function assertJobNotTerminal(
    job: { status: string; id?: string },
    entityId?: string
): void {
    if (isJobTerminal(job.status)) {
        throw new TerminalStateError('job', job.status, entityId || job.id);
    }
}

/**
 * Assert that a payment is not in a terminal state
 * @throws {TerminalStateError} if payment is COMPLETED or REFUNDED
 */
export function assertPaymentNotTerminal(
    payment: { status: string; id?: string },
    entityId?: string
): void {
    if (isPaymentTerminal(payment.status)) {
        throw new TerminalStateError('payment', payment.status, entityId || payment.id);
    }
}

/**
 * Assert that an invoice is not in a terminal state
 * @throws {TerminalStateError} if invoice is AUTHORIZED or VOIDED
 */
export function assertInvoiceNotTerminal(
    invoice: { status: string; id?: string },
    entityId?: string
): void {
    if (isInvoiceTerminal(invoice.status)) {
        throw new TerminalStateError('invoice', invoice.status, entityId || invoice.id);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION RESULT FUNCTIONS (return result instead of throwing)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TerminalStateCheckResult {
    isTerminal: boolean;
    status?: string;
    error?: string;
}

/**
 * Check if job is terminal, returning a result object
 */
export function checkJobTerminalState(status: string): TerminalStateCheckResult {
    if (isJobTerminal(status)) {
        const statusText = status === 'COMPLETED' ? 'completado' : 'cancelado';
        return {
            isTerminal: true,
            status,
            error: `No se puede modificar un trabajo ${statusText}`,
        };
    }
    return { isTerminal: false };
}

/**
 * Check if payment is terminal, returning a result object
 */
export function checkPaymentTerminalState(status: string): TerminalStateCheckResult {
    if (isPaymentTerminal(status)) {
        const statusText = status === 'COMPLETED' ? 'completado' : 'reembolsado';
        return {
            isTerminal: true,
            status,
            error: `No se puede modificar un pago ${statusText}`,
        };
    }
    return { isTerminal: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log a terminal state violation attempt for audit purposes
 */
export function logTerminalStateViolation(
    entityType: 'job' | 'payment' | 'invoice',
    entityId: string,
    currentStatus: string,
    attemptedAction: string,
    userId?: string
): void {
    console.warn('[SECURITY] Terminal state violation attempt:', {
        entityType,
        entityId,
        currentStatus,
        attemptedAction,
        userId,
        timestamp: new Date().toISOString(),
    });
}
