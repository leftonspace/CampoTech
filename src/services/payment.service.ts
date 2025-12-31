import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

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

        const where: Prisma.PaymentWhereInput = {
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
            if (minAmount !== undefined) where.amount.gte = new Prisma.Decimal(minAmount);
            if (maxAmount !== undefined) where.amount.lte = new Prisma.Decimal(maxAmount);
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
     */
    static async createPayment(orgId: string, data: any) {
        const { invoiceId, amount, method, reference, notes, paidAt, status = 'COMPLETED' } = data;

        // Verify invoice
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, organizationId: orgId }
        });

        if (!invoice) throw new Error('Invoice not found');

        return prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    organizationId: orgId,
                    invoiceId,
                    amount: new Prisma.Decimal(amount),
                    method: (method?.toUpperCase() || 'CASH') as any,
                    status: status.toUpperCase() as any,
                    reference,
                    paidAt: paidAt ? new Date(paidAt) : new Date(),
                },
                include: { invoice: true }
            });

            // Update invoice status if fully paid
            if (payment.status === 'COMPLETED') {
                const aggregate = await tx.payment.aggregate({
                    where: { invoiceId, status: 'COMPLETED' },
                    _sum: { amount: true }
                });

                const totalPaid = Number(aggregate._sum.amount || 0);
                if (totalPaid >= Number(invoice.total)) {
                    await tx.invoice.update({
                        where: { id: invoiceId },
                        data: { status: 'PAID' }
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
     */
    static async updatePayment(orgId: string, id: string, data: any) {
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
