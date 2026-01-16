/**
 * Customer Folder Service
 * =======================
 * 
 * Phase 3: Client Data Folder Implementation
 * 
 * Provides unified access to all customer-related data:
 * - Profile information
 * - Job history with snapshot data
 * - Invoice and payment history
 * - WhatsApp conversation logs
 * - Summary statistics
 */

import { prisma } from '@/lib/prisma';
import { formatAddress } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface CustomerFolderSummary {
    totalJobs: number;
    completedJobs: number;
    pendingJobs: number;
    totalInvoiced: number;
    totalPaid: number;
    averageRating: number | null;
    whatsappMessages: number;
    firstServiceDate: Date | null;
    lastServiceDate: Date | null;
}

export interface CustomerFolderJob {
    id: string;
    jobNumber: string;
    serviceType: string;
    serviceTypeCode: string | null;
    description: string;
    status: string;
    scheduledDate: Date | null;
    completedAt: Date | null;
    resolution: string | null;
    photos: string[];
    hasSignature: boolean;
    // Pricing
    estimatedTotal: number | null;
    finalTotal: number | null;
    // Vehicle/Technician snapshots
    technicianName: string | null;
    vehiclePlate: string | null;
    vehicleInfo: string | null;
    mileageStart: number | null;
    mileageEnd: number | null;
    // Visits count
    visitsCount: number;
    visitsCompleted: number;
}

export interface CustomerFolderInvoice {
    id: string;
    invoiceNumber: string;
    type: string;
    status: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    issuedAt: Date | null;
    afipCae: string | null;
    jobId: string | null;
}

export interface CustomerFolderPayment {
    id: string;
    amount: number;
    method: string;
    status: string;
    reference: string | null;
    paidAt: Date | null;
    invoiceNumber: string;
}

export interface CustomerFolderWhatsAppMessage {
    id: string;
    direction: string;
    content: string | null;
    timestamp: Date;
    status: string;
}

export interface CustomerFolderData {
    customer: {
        id: string;
        name: string;
        phone: string;
        email: string | null;
        address: string;
        cuit: string | null;
        ivaCondition: string | null;
        notes: string | null;
        isVip: boolean;
        createdAt: Date;
    };
    summary: CustomerFolderSummary;
    jobs: CustomerFolderJob[];
    invoices: CustomerFolderInvoice[];
    payments: CustomerFolderPayment[];
}

// =============================================================================
// MAIN SERVICE FUNCTIONS
// =============================================================================

/**
 * Fetch complete customer folder data including summary, jobs, invoices, and payments
 */
export async function getCustomerFolderData(
    customerId: string,
    organizationId: string
): Promise<CustomerFolderData | null> {
    // Fetch customer with all related data
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId },
        include: {
            jobs: {
                orderBy: { scheduledDate: 'desc' },
                include: {
                    technician: {
                        select: { name: true }
                    },
                    vehicle: {
                        select: { make: true, model: true, plateNumber: true }
                    },
                    visits: {
                        select: { id: true, status: true }
                    },
                    review: {
                        select: { rating: true }
                    }
                }
            },
            invoices: {
                orderBy: { createdAt: 'desc' },
                include: {
                    payments: {
                        select: {
                            id: true,
                            amount: true,
                            method: true,
                            status: true,
                            reference: true,
                            paidAt: true
                        }
                    }
                }
            },
            waConversations: {
                select: {
                    _count: {
                        select: { messages: true }
                    }
                }
            }
        }
    });


    if (!customer) return null;

    // Type aliases for better type inference
    type CustomerJob = typeof customer.jobs[number];
    type CustomerInvoice = typeof customer.invoices[number];
    type InvoicePayment = CustomerInvoice['payments'][number];
    type JobVisit = CustomerJob['visits'][number];
    type WaConversation = typeof customer.waConversations[number];

    // Calculate summary statistics
    const completedJobs = customer.jobs.filter((j: CustomerJob) => j.status === 'COMPLETED');
    const pendingJobs = customer.jobs.filter((j: CustomerJob) => ['PENDING', 'IN_PROGRESS'].includes(j.status));

    const totalInvoiced = customer.invoices.reduce(
        (sum: number, inv: CustomerInvoice) => sum + Number(inv.total),
        0
    );

    const totalPaid = customer.invoices.reduce((sum: number, inv: CustomerInvoice) => {
        const invoicePaid = inv.payments
            .filter((p: InvoicePayment) => p.status === 'COMPLETED')
            .reduce((pSum: number, p: InvoicePayment) => pSum + Number(p.amount), 0);
        return sum + invoicePaid;
    }, 0);

    // Calculate average rating from reviews
    const ratings = customer.jobs
        .map((j: CustomerJob) => j.review?.rating)
        .filter((r: number | null | undefined): r is number => r !== null && r !== undefined);
    const averageRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : null;

    // Count WhatsApp messages
    const whatsappMessages = customer.waConversations.reduce(
        (sum: number, conv: WaConversation) => sum + conv._count.messages,
        0
    );

    // Get first and last service dates
    const completedDates = completedJobs
        .map((j: CustomerJob) => j.completedAt)
        .filter((d: Date | null): d is Date => d !== null)
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());

    // Transform jobs for folder view
    const transformedJobs: CustomerFolderJob[] = customer.jobs.map((job: CustomerJob) => ({
        id: job.id,
        jobNumber: job.jobNumber,
        serviceType: job.serviceType,
        serviceTypeCode: job.serviceTypeCode,
        description: job.description,
        status: job.status,
        scheduledDate: job.scheduledDate,
        completedAt: job.completedAt,
        resolution: job.resolution,
        photos: job.photos || [],
        hasSignature: !!job.customerSignature,
        estimatedTotal: job.estimatedTotal ? Number(job.estimatedTotal) : null,
        finalTotal: job.finalTotal ? Number(job.finalTotal) : null,
        technicianName: job.driverNameAtJob || job.technician?.name || null,
        vehiclePlate: job.vehiclePlateAtJob || job.vehicle?.plateNumber || null,
        vehicleInfo: job.vehicle
            ? `${job.vehicle.make || ''} ${job.vehicle.model || ''}`.trim() || null
            : null,
        mileageStart: job.vehicleMileageStart,
        mileageEnd: job.vehicleMileageEnd,
        visitsCount: job.visits.length,
        visitsCompleted: job.visits.filter((v: JobVisit) => v.status === 'COMPLETED').length
    }));

    // Transform invoices
    const transformedInvoices: CustomerFolderInvoice[] = customer.invoices.map((inv: CustomerInvoice) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        status: inv.status,
        subtotal: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        total: Number(inv.total),
        issuedAt: inv.issuedAt,
        afipCae: inv.afipCae,
        jobId: inv.jobId
    }));

    // Flatten all payments with invoice reference
    const transformedPayments: CustomerFolderPayment[] = customer.invoices.flatMap((inv: CustomerInvoice) =>
        inv.payments.map((payment: InvoicePayment) => ({
            id: payment.id,
            amount: Number(payment.amount),
            method: payment.method,
            status: payment.status,
            reference: payment.reference,
            paidAt: payment.paidAt,
            invoiceNumber: inv.invoiceNumber
        }))
    );

    return {
        customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: typeof customer.address === 'string'
                ? customer.address
                : formatAddress(customer.address) || '',
            cuit: (customer as { cuit?: string | null }).cuit || null,
            ivaCondition: (customer as { ivaCondition?: string | null }).ivaCondition || null,
            notes: customer.notes,
            isVip: customer.isVip,
            createdAt: customer.createdAt
        },
        summary: {
            totalJobs: customer.jobs.length,
            completedJobs: completedJobs.length,
            pendingJobs: pendingJobs.length,
            totalInvoiced,
            totalPaid,
            averageRating,
            whatsappMessages,
            firstServiceDate: completedDates[0] || null,
            lastServiceDate: completedDates[completedDates.length - 1] || null
        },
        jobs: transformedJobs,
        invoices: transformedInvoices,
        payments: transformedPayments
    };
}

/**
 * Get WhatsApp conversation history for a customer
 */
export async function getCustomerWhatsAppHistory(
    customerId: string,
    organizationId: string,
    options: { limit?: number; offset?: number } = {}
): Promise<{ messages: CustomerFolderWhatsAppMessage[]; total: number } | null> {
    const { limit = 50, offset = 0 } = options;

    // First verify customer belongs to organization
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId },
        select: { phone: true }
    });

    if (!customer) return null;

    // Get conversation for this customer's phone
    const conversation = await prisma.waConversation.findFirst({
        where: {
            organizationId,
            customerPhone: customer.phone
        },
        include: {
            messages: {
                orderBy: { timestamp: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    direction: true,
                    body: true,
                    timestamp: true,
                    status: true
                }
            },
            _count: {
                select: { messages: true }
            }
        }
    });

    if (!conversation) {
        return { messages: [], total: 0 };
    }

    // Type for message from the query
    type WaMessage = typeof conversation.messages[number];

    return {
        messages: conversation.messages.map((msg: WaMessage) => ({
            id: msg.id,
            direction: msg.direction,
            content: msg.body,
            timestamp: msg.timestamp,
            status: msg.status
        })),
        total: conversation._count.messages
    };
}

/**
 * Get folder summary statistics only (for quick loading)
 */
export async function getCustomerFolderSummary(
    customerId: string,
    organizationId: string
): Promise<CustomerFolderSummary | null> {
    const data = await getCustomerFolderData(customerId, organizationId);
    return data?.summary || null;
}
