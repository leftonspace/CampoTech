/**
 * Payment Audit Logger
 * =====================
 *
 * Phase 4 Security Remediation: Finding 3
 * Unified audit logging for all payment operations.
 *
 * Provides comprehensive financial forensics capability by logging:
 * - Payment creation (marketplace and subscription)
 * - Payment status changes
 * - Refunds and disputes
 * - Invoice generation
 * - Amount validation failures
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PaymentAuditAction =
    | 'payment_created'
    | 'payment_completed'
    | 'payment_failed'
    | 'payment_pending'
    | 'payment_refunded'
    | 'payment_disputed'
    | 'payment_amount_validated'
    | 'payment_amount_rejected'
    | 'invoice_created'
    | 'invoice_paid'
    | 'invoice_partially_paid'
    | 'subscription_payment_created'
    | 'subscription_payment_completed'
    | 'subscription_payment_failed'
    | 'subscription_refunded'
    | 'webhook_processed'
    | 'webhook_rejected';

export type PaymentActorType = 'user' | 'system' | 'webhook' | 'cron';

export interface PaymentAuditContext {
    /** Organization ID (required) */
    organizationId: string;
    /** User ID if action was user-initiated */
    userId?: string;
    /** Actor type */
    actorType: PaymentActorType;
    /** IP address if available */
    ipAddress?: string;
    /** User agent if available */
    userAgent?: string;
}

export interface PaymentAuditData {
    // Payment identifiers
    paymentId?: string;
    invoiceId?: string;
    subscriptionId?: string;
    subscriptionPaymentId?: string;

    // MercadoPago identifiers
    mpPaymentId?: string;
    mpPreferenceId?: string;
    mpExternalReference?: string;
    mpRefundId?: string;

    // Financial data
    amount?: number;
    currency?: string;
    paymentMethod?: string;
    status?: string;
    previousStatus?: string;

    // Validation data
    expectedAmount?: number;
    providedAmount?: number;
    remainingBalance?: number;
    validationError?: string;

    // Invoice data
    invoiceNumber?: string;
    invoiceTotal?: number;
    totalPaid?: number;

    // Subscription data
    tier?: string;
    billingCycle?: string;

    // Webhook data
    webhookId?: string;
    webhookAction?: string;
    webhookEventType?: string;

    // Error data
    errorMessage?: string;
    errorCode?: string;

    // Additional context
    reason?: string;
    notes?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT AUDIT LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

export class PaymentAuditLogger {
    /**
     * Log a payment audit event
     */
    static async log(
        action: PaymentAuditAction,
        context: PaymentAuditContext,
        data: PaymentAuditData
    ): Promise<void> {
        try {
            // Determine entity type and ID based on action
            const { entityType, entityId } = this.determineEntity(action, data);

            // Create audit log entry
            await prisma.auditLog.create({
                data: {
                    organizationId: context.organizationId,
                    userId: context.userId || null,
                    action,
                    entityType,
                    entityId,
                    metadata: {
                        ...data,
                        actorType: context.actorType,
                        timestamp: new Date().toISOString(),
                    },
                    ipAddress: context.ipAddress || null,
                    userAgent: context.userAgent || null,
                },
            });

            // Log to console for debugging/monitoring
            console.log(`[PaymentAudit] ${action}`, {
                orgId: context.organizationId,
                actorType: context.actorType,
                entityType,
                entityId,
                amount: data.amount,
                status: data.status,
            });
        } catch (error) {
            // Never fail the main operation due to audit logging failure
            console.error('[PaymentAudit] Failed to log audit event:', error, {
                action,
                context,
                data,
            });
        }
    }

    /**
     * Determine entity type and ID from action and data
     */
    private static determineEntity(
        action: PaymentAuditAction,
        data: PaymentAuditData
    ): { entityType: string; entityId: string | null } {
        if (action.startsWith('subscription_') || action === 'subscription_refunded') {
            return {
                entityType: 'subscription_payment',
                entityId: data.subscriptionPaymentId || data.mpPaymentId || null,
            };
        }

        if (action.startsWith('invoice_')) {
            return {
                entityType: 'invoice',
                entityId: data.invoiceId || null,
            };
        }

        if (action.startsWith('webhook_')) {
            return {
                entityType: 'webhook',
                entityId: data.webhookId || data.mpPaymentId || null,
            };
        }

        // Default: payment entity
        return {
            entityType: 'payment',
            entityId: data.paymentId || data.mpPaymentId || null,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // CONVENIENCE METHODS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * Log marketplace payment creation
     */
    static async logPaymentCreated(
        orgId: string,
        paymentId: string,
        invoiceId: string,
        amount: number,
        method: string,
        userId?: string,
        ipAddress?: string
    ): Promise<void> {
        await this.log(
            'payment_created',
            {
                organizationId: orgId,
                userId,
                actorType: userId ? 'user' : 'system',
                ipAddress,
            },
            {
                paymentId,
                invoiceId,
                amount,
                paymentMethod: method,
                status: 'PENDING',
            }
        );
    }

    /**
     * Log payment completion
     */
    static async logPaymentCompleted(
        orgId: string,
        paymentId: string,
        invoiceId: string,
        amount: number,
        method: string,
        userId?: string
    ): Promise<void> {
        await this.log(
            'payment_completed',
            {
                organizationId: orgId,
                userId,
                actorType: userId ? 'user' : 'system',
            },
            {
                paymentId,
                invoiceId,
                amount,
                paymentMethod: method,
                status: 'COMPLETED',
                previousStatus: 'PENDING',
            }
        );
    }

    /**
     * Log payment amount validation success
     */
    static async logAmountValidated(
        orgId: string,
        invoiceId: string,
        providedAmount: number,
        remainingBalance: number,
        userId?: string
    ): Promise<void> {
        await this.log(
            'payment_amount_validated',
            {
                organizationId: orgId,
                userId,
                actorType: userId ? 'user' : 'system',
            },
            {
                invoiceId,
                providedAmount,
                remainingBalance,
                amount: providedAmount,
            }
        );
    }

    /**
     * Log payment amount validation failure
     */
    static async logAmountRejected(
        orgId: string,
        invoiceId: string,
        providedAmount: number,
        expectedAmount: number,
        remainingBalance: number,
        validationError: string,
        userId?: string,
        ipAddress?: string
    ): Promise<void> {
        await this.log(
            'payment_amount_rejected',
            {
                organizationId: orgId,
                userId,
                actorType: userId ? 'user' : 'system',
                ipAddress,
            },
            {
                invoiceId,
                providedAmount,
                expectedAmount,
                remainingBalance,
                validationError,
            }
        );
    }

    /**
     * Log invoice creation
     */
    static async logInvoiceCreated(
        orgId: string,
        invoiceId: string,
        invoiceNumber: string,
        total: number,
        userId?: string
    ): Promise<void> {
        await this.log(
            'invoice_created',
            {
                organizationId: orgId,
                userId,
                actorType: userId ? 'user' : 'system',
            },
            {
                invoiceId,
                invoiceNumber,
                invoiceTotal: total,
                amount: total,
            }
        );
    }

    /**
     * Log invoice payment (fully paid)
     */
    static async logInvoicePaid(
        orgId: string,
        invoiceId: string,
        invoiceNumber: string,
        total: number,
        totalPaid: number
    ): Promise<void> {
        await this.log(
            'invoice_paid',
            {
                organizationId: orgId,
                actorType: 'system',
            },
            {
                invoiceId,
                invoiceNumber,
                invoiceTotal: total,
                totalPaid,
                status: 'PAID',
            }
        );
    }

    /**
     * Log subscription payment from webhook
     */
    static async logSubscriptionPayment(
        orgId: string,
        subscriptionPaymentId: string,
        subscriptionId: string,
        action: 'subscription_payment_created' | 'subscription_payment_completed' | 'subscription_payment_failed',
        amount: number,
        mpPaymentId?: string,
        tier?: string,
        billingCycle?: string,
        errorMessage?: string
    ): Promise<void> {
        await this.log(
            action,
            {
                organizationId: orgId,
                actorType: 'webhook',
            },
            {
                subscriptionPaymentId,
                subscriptionId,
                mpPaymentId,
                amount,
                tier,
                billingCycle,
                errorMessage,
                status: action === 'subscription_payment_completed' ? 'completed' : action === 'subscription_payment_failed' ? 'failed' : 'pending',
            }
        );
    }

    /**
     * Log refund processing
     */
    static async logRefund(
        orgId: string,
        paymentId: string,
        amount: number,
        mpRefundId?: string,
        reason?: string,
        isSubscription: boolean = false
    ): Promise<void> {
        await this.log(
            isSubscription ? 'subscription_refunded' : 'payment_refunded',
            {
                organizationId: orgId,
                actorType: 'webhook',
            },
            {
                paymentId,
                amount,
                mpRefundId,
                reason,
                status: 'REFUNDED',
            }
        );
    }

    /**
     * Log webhook processing
     */
    static async logWebhookProcessed(
        orgId: string,
        webhookId: string,
        webhookAction: string,
        webhookEventType: string,
        mpPaymentId?: string,
        success: boolean = true,
        errorMessage?: string
    ): Promise<void> {
        await this.log(
            success ? 'webhook_processed' : 'webhook_rejected',
            {
                organizationId: orgId,
                actorType: 'webhook',
            },
            {
                webhookId,
                webhookAction,
                webhookEventType,
                mpPaymentId,
                errorMessage: success ? undefined : errorMessage,
            }
        );
    }
}
