import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export interface InvoiceFilter {
    status?: string;
    customerId?: string;
}

export class InvoiceService {
    /**
     * List invoices with filtering and pagination
     */
    static async listInvoices(orgId: string, filters: InvoiceFilter = {}, pagination: { page?: number; limit?: number } = {}) {
        const { status, customerId } = filters;
        const { page = 1, limit = 20 } = pagination;

        const where: any = {
            organizationId: orgId,
        };

        if (status) {
            const statusMap: Record<string, string> = {
                'pending_cae': 'PENDING',
                'draft': 'DRAFT',
                'pending': 'PENDING',
                'sent': 'SENT',
                'paid': 'PAID',
                'overdue': 'OVERDUE',
                'cancelled': 'CANCELLED',
            };
            const mappedStatus = statusMap[status.toLowerCase()] || status.toUpperCase();
            const validStatuses = ['DRAFT', 'PENDING', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
            if (validStatuses.includes(mappedStatus)) {
                where.status = mappedStatus as any;
            }
        }

        if (customerId) where.customerId = customerId;

        const [items, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, email: true, phone: true } },
                    lineItems: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.invoice.count({ where }),
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
     * Create an invoice with line items
     */
    static async createInvoice(orgId: string, data: any) {
        const {
            customerId,
            invoiceType = 'C',
            issueDate,
            dueDate,
            jobId,
            lineItems = [],
            asDraft = false,
        } = data;

        // Calculate totals
        let subtotal = 0;
        let totalIva = 0;

        const processedLineItems = lineItems.map((item: any) => {
            const itemSubtotal = item.quantity * item.unitPrice;
            const itemIva = (itemSubtotal * (item.ivaRate || 21)) / 100;
            subtotal += itemSubtotal;
            totalIva += itemIva;

            return {
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.ivaRate || 21,
                subtotal: itemSubtotal,
                taxAmount: itemIva,
                total: itemSubtotal + itemIva,
            };
        });

        // Map short invoice type to full enum value
        const invoiceTypeMap: Record<string, string> = {
            'A': 'FACTURA_A', 'B': 'FACTURA_B', 'C': 'FACTURA_C',
            'FACTURA_A': 'FACTURA_A', 'FACTURA_B': 'FACTURA_B', 'FACTURA_C': 'FACTURA_C',
        };
        const mappedInvoiceType = invoiceTypeMap[invoiceType.toUpperCase()] || 'FACTURA_C';

        // Generate invoice number
        const lastInvoice = await prisma.invoice.findFirst({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
            select: { invoiceNumber: true },
        });

        const nextNumber = lastInvoice?.invoiceNumber
            ? parseInt(lastInvoice.invoiceNumber.split('-')[1] || '0') + 1
            : 1;
        const invoiceNumber = `${invoiceType}-${String(nextNumber).padStart(8, '0')}`;

        return prisma.invoice.create({
            data: {
                organizationId: orgId,
                customerId,
                invoiceNumber,
                type: mappedInvoiceType as any,
                status: asDraft ? 'DRAFT' : 'PENDING',
                issuedAt: issueDate ? new Date(issueDate) : new Date(),
                dueDate: dueDate ? new Date(dueDate) : null,
                jobId: jobId || null,
                subtotal,
                taxAmount: totalIva,
                total: subtotal + totalIva,
                items: processedLineItems,
                lineItems: { create: processedLineItems },
            },
            include: {
                customer: true,
                lineItems: true,
            },
        });
    }

    /**
     * Get a single invoice by ID
     */
    static async getInvoiceById(orgId: string, id: string) {
        return prisma.invoice.findFirst({
            where: { id, organizationId: orgId },
            include: {
                customer: true,
                lineItems: true,
                payments: true,
            },
        });
    }

    /**
     * Update an invoice
     */
    static async updateInvoice(orgId: string, id: string, data: any) {
        return prisma.invoice.update({
            where: { id, organizationId: orgId },
            data,
            include: {
                customer: true,
                lineItems: true,
            },
        });
    }

    /**
     * Delete an invoice (only if draft)
     */
    static async deleteInvoice(orgId: string, id: string) {
        return prisma.invoice.delete({
            where: { id, organizationId: orgId, status: 'DRAFT' as any },
        });
    }

    /**
     * Record a payment for an invoice
     */
    static async recordPayment(orgId: string, id: string, paymentData: any) {
        const { amount, method, reference, notes, date } = paymentData;

        return prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({
                where: { id },
                include: { payments: true },
            });

            if (!invoice) throw new Error('Invoice not found');

            const totalPaid = (invoice.payments as any[])
                .filter((p: any) => p.status === 'COMPLETED')
                .reduce((sum: number, p: any) => sum + Number(p.amount), 0) + amount;

            const newStatus = totalPaid >= Number(invoice.total) ? 'PAID' : 'SENT'; // Assuming SENT if not fully paid

            // Create payment
            await tx.payment.create({
                data: {
                    organizationId: orgId,
                    invoiceId: id,
                    amount,
                    method: method.toUpperCase() as any,
                    status: 'COMPLETED',
                    reference,
                    paidAt: date ? new Date(date) : new Date(),
                    // notes is not in Payment model, let's omit or use reference
                },
            });

            // Update invoice
            return tx.invoice.update({
                where: { id },
                data: {
                    status: newStatus as any,
                },
                include: { customer: true, lineItems: true, payments: true },
            });
        });
    }
}
