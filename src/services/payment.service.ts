import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 SECURITY REMEDIATION: PAYMENT AUDIT LOGGING
// Inline implementation to avoid cross-package import issues
// ═══════════════════════════════════════════════════════════════════════════════

type PaymentAuditAction =
    | 'payment_created'
    | 'payment_completed'
    | 'payment_amount_validated'
    | 'payment_amount_rejected'
    | 'payment_refunded';

async function logPaymentAudit(
    action: PaymentAuditAction,
    orgId: string,
    data: {
        paymentId?: string;
        invoiceId?: string;
        amount?: number;
        method?: string;
        status?: string;
        providedAmount?: number;
        remainingBalance?: number;
        validationError?: string;
        userId?: string;
    }
): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                organizationId: orgId,
                userId: data.userId || null,
                action,
                entityType: 'payment',
                entityId: data.paymentId || null,
                metadata: {
                    ...data,
                    actorType: data.userId ? 'user' : 'system',
                    timestamp: new Date().toISOString(),
                },
            },
        });
        console.log(`[PaymentAudit] ${action}`, { orgId, paymentId: data.paymentId, amount: data.amount });
    } catch (error) {
        // Never fail the main operation due to audit logging failure
        console.error('[PaymentAudit] Failed to log:', error);
    }
}

export interface PaymentFilter {
    status?: string;
    invoiceId?: string;
    customerId?: string;
    jobId?: string;
}

export class PaymentService {
    /**
     * List payments with filtering and pagination
     */
    static async listPayments(orgId: string, filters: any = {}, pagination: any = {}) {
        const { status, invoiceId, customerId, jobId, paymentMethod, paymentType, search, createdAfter, createdBefore, minAmount, maxAmount } = filters;
        const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

        const where: any = {
            organizationId: orgId,
        };

        if (status) {
            const statusMap: Record<string, string> = {
                'pending': 'PENDING',
                'completed': 'COMPLETED',
                'failed': 'FAILED',
                'refunded': 'REFUNDED',
                'cancelled': 'CANCELLED',
            };
            const mappedStatus = statusMap[status.toLowerCase()] || status.toUpperCase();
            const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED'];
            if (validStatuses.includes(mappedStatus)) {
                where.status = mappedStatus as any;
            }
        }

        if (invoiceId) where.invoiceId = invoiceId;

        if (customerId || jobId) {
            where.invoice = {
                organizationId: orgId,
            };
            if (customerId) where.invoice.customerId = customerId;
            if (jobId) where.invoice.jobId = jobId;
        }

        if (paymentMethod) where.method = paymentMethod.toUpperCase() as any;

        if (createdAfter || createdBefore) {
            where.createdAt = {};
            if (createdAfter) where.createdAt.gte = new Date(createdAfter);
            if (createdBefore) where.createdAt.lte = new Date(createdBefore);
        }

        if (minAmount !== undefined || maxAmount !== undefined) {
            where.amount = {};
            if (minAmount !== undefined) where.amount.gte = minAmount;
            if (maxAmount !== undefined) where.amount.lte = maxAmount;
        }

        if (search) {
            where.reference = { contains: search, mode: 'insensitive' };
        }

        const [items, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    invoice: {
                        include: {
                            customer: {
                                select: { id: true, name: true, email: true, phone: true }
                            }
                        }
                    },
                },
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.payment.count({ where }),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get a single payment by ID
     */
    static async getPaymentById(orgId: string, id: string, include: string[] = []) {
        const includes: any = {
            invoice: {
                include: {
                    customer: true
                }
            },
        };

        return prisma.payment.findFirst({
            where: {
                id,
                organizationId: orgId,
            },
            include: includes,
        });
    }

    /**
     * Record a new payment
     * 
     * Phase 4 Security Remediation (Finding 2):
     * - Server-side amount validation prevents overpayment/manipulation
     * - Audit logging for all payment operations (Finding 3)
     */
    static async createPayment(orgId: string, data: any, userId?: string) {
        const { invoiceId, amount, method, reference, notes, paidAt, status = 'COMPLETED' } = data;

        // ═══════════════════════════════════════════════════════════════════════
        // PHASE 4 SECURITY: Input validation
        // ═══════════════════════════════════════════════════════════════════════

        const numericAmount = Number(amount);

        // Validate amount is positive
        if (isNaN(numericAmount) || numericAmount <= 0) {
            await logPaymentAudit('payment_amount_rejected', orgId, {
                invoiceId,
                providedAmount: numericAmount,
                validationError: 'Payment amount must be a positive number',
                userId,
            });
            throw new Error('Payment amount must be a positive number');
        }

        // Verify invoice and get existing payments
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, organizationId: orgId },
            include: {
                payments: {
                    where: { status: 'COMPLETED' },
                    select: { amount: true }
                }
            }
        });

        if (!invoice) throw new Error('Invoice not found');

        // ═══════════════════════════════════════════════════════════════════════
        // PHASE 4 SECURITY (Finding 2): Server-side amount validation
        // Prevents payment manipulation by validating against remaining balance
        // ═══════════════════════════════════════════════════════════════════════

        const invoiceTotal = Number(invoice.total);
        const totalPaidBefore = invoice.payments.reduce(
            (sum: number, p: { amount: Prisma.Decimal | null }) => sum + Number(p.amount || 0),
            0
        );
        const remainingBalance = invoiceTotal - totalPaidBefore;

        // Validate payment doesn't exceed remaining balance (with small tolerance for rounding)
        const TOLERANCE = 0.01; // 1 centavo tolerance for floating-point rounding
        if (numericAmount > remainingBalance + TOLERANCE) {
            await logPaymentAudit('payment_amount_rejected', orgId, {
                invoiceId,
                providedAmount: numericAmount,
                remainingBalance,
                validationError: `Payment exceeds remaining balance. Provided: $${numericAmount.toFixed(2)}, Remaining: $${remainingBalance.toFixed(2)}`,
                userId,
            });
            throw new Error(
                `El monto del pago ($${numericAmount.toFixed(2)}) excede el saldo restante ($${remainingBalance.toFixed(2)})`
            );
        }

        // Log successful validation
        await logPaymentAudit('payment_amount_validated', orgId, {
            invoiceId,
            providedAmount: numericAmount,
            remainingBalance,
            userId,
        });

        return prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    organizationId: orgId,
                    invoiceId,
                    amount: numericAmount,
                    method: (method?.toUpperCase() || 'CASH') as any,
                    status: status.toUpperCase() as any,
                    reference,
                    paidAt: paidAt ? new Date(paidAt) : new Date(),
                },
                include: { invoice: true }
            });

            // ═══════════════════════════════════════════════════════════════════════
            // PHASE 4 SECURITY (Finding 3): Audit logging
            // ═══════════════════════════════════════════════════════════════════════

            await logPaymentAudit('payment_created', orgId, {
                paymentId: payment.id,
                invoiceId,
                amount: numericAmount,
                method: method?.toUpperCase() || 'CASH',
                status: status.toUpperCase(),
                userId,
            });

            // Update invoice status if fully paid
            if (payment.status === 'COMPLETED') {
                const aggregate = await tx.payment.aggregate({
                    where: { invoiceId, status: 'COMPLETED' },
                    _sum: { amount: true }
                });

                const totalPaid = Number(aggregate._sum.amount || 0);
                if (totalPaid >= invoiceTotal) {
                    await tx.invoice.update({
                        where: { id: invoiceId },
                        data: { status: 'PAID' }
                    });

                    // Log invoice fully paid
                    await logPaymentAudit('payment_completed', orgId, {
                        paymentId: payment.id,
                        invoiceId,
                        amount: totalPaid,
                        status: 'PAID',
                    });
                } else if (totalPaid > 0) {
                    await tx.invoice.update({
                        where: { id: invoiceId },
                        data: { status: 'SENT' }
                    });
                }
            }

            return payment;
        });
    }

    /**
     * Update a payment
     * Phase 10 Security: Validates terminal state before allowing updates
     */
    static async updatePayment(orgId: string, id: string, data: any) {
        // Phase 10 Security: Check terminal state before update
        const existing = await prisma.payment.findFirst({
            where: { id, organizationId: orgId },
            select: { status: true },
        });

        const TERMINAL_PAYMENT_STATES = ['COMPLETED', 'REFUNDED'];
        if (existing && TERMINAL_PAYMENT_STATES.includes(existing.status)) {
            console.warn('[SECURITY] Payment update terminal state violation:', {
                paymentId: id,
                currentStatus: existing.status,
                timestamp: new Date().toISOString(),
            });
            throw new Error(`No se puede modificar un pago ${existing.status === 'COMPLETED' ? 'completado' : 'reembolsado'}`);
        }

        const { status, reference, notes, metadata, externalTransactionId } = data;

        return prisma.payment.update({
            where: { id, organizationId: orgId },
            data: {
                status: status?.toUpperCase() as any,
                reference,
                // Add mapping for other fields if needed
            },
            include: { invoice: true }
        });
    }

    /**
     * Delete a payment
     */
    static async deletePayment(orgId: string, id: string) {
        const payment = await prisma.payment.findFirst({
            where: { id, organizationId: orgId }
        });

        if (!payment) throw new Error('Payment not found');
        if (payment.status !== 'PENDING') throw new Error('Only pending payments can be deleted');

        return prisma.payment.delete({
            where: { id }
        });
    }

    /**
     * Cancel a payment
     */
    static async cancelPayment(orgId: string, id: string, reason?: string) {
        return prisma.payment.update({
            where: { id, organizationId: orgId },
            data: {
                status: 'CANCELLED' as any,
                // notes: reason ? `Cancelled: ${reason}` : undefined,
            },
            include: { invoice: true }
        });
    }

    /**
     * Refund a payment
     */
    static async refundPayment(orgId: string, id: string, amount?: number, reason?: string, notes?: string) {
        const payment = await this.getPaymentById(orgId, id);
        if (!payment) throw new Error('Payment not found');

        const refundAmount = amount || Number(payment.amount);

        return prisma.$transaction(async (tx) => {
            const updatedPayment = await tx.payment.update({
                where: { id },
                data: {
                    status: 'REFUNDED',
                    // Logic for partial refunds could be added here
                },
                include: { invoice: true }
            });

            // Re-calculate invoice status
            const aggregate = await tx.payment.aggregate({
                where: { invoiceId: payment.invoiceId, status: 'COMPLETED' },
                _sum: { amount: true }
            });

            const totalPaid = Number(aggregate._sum.amount || 0);
            const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });

            if (invoice) {
                let newStatus: any = 'SENT';
                if (totalPaid >= Number(invoice.total)) {
                    newStatus = 'PAID';
                } else if (totalPaid <= 0) {
                    newStatus = 'SENT';
                }

                await tx.invoice.update({
                    where: { id: payment.invoiceId },
                    data: { status: newStatus }
                });
            }

            return updatedPayment;
        });
    }
}
