/**
 * Billing Pipeline API
 * ====================
 * 
 * Unified endpoint that aggregates jobs, invoices, payments, and AFIP queue
 * into a single pipeline view for the Billing Hub.
 * 
 * GET /api/billing/pipeline - Returns pipeline items + summary stats
 * 
 * Pipeline Stages:
 *   COBRADO    - Job completed + payment collected, no invoice yet
 *   FACTURAR   - Invoice exists as DRAFT, needs submission
 *   EN_AFIP    - Invoice in PENDING status (waiting for CAE)
 *   ENVIADA    - Invoice SENT (CAE received, delivered to customer)
 *   CERRADO    - Invoice PAID + payments reconciled
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessModule, UserRole } from '@/lib/middleware/field-filter';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PipelineStage = 'COBRADO' | 'FACTURAR' | 'EN_AFIP' | 'ENVIADA' | 'CERRADO';

interface PipelineItem {
    id: string;
    stage: PipelineStage;
    // Job info
    jobId?: string | null;
    jobNumber?: string | null;
    serviceType?: string | null;
    completedAt?: string | null;
    // Customer info
    customerId: string;
    customerName: string;
    customerPhone?: string | null;
    // Invoice info
    invoiceId?: string | null;
    invoiceNumber?: string | null;
    invoiceType?: string | null;
    invoiceStatus?: string | null;
    // Financial info
    subtotal: number;
    taxAmount: number;
    total: number;
    totalPaid: number;
    balance: number;
    // AFIP info
    afipCae?: string | null;
    afipCaeExpiry?: string | null;
    afipQrCode?: string | null;
    // Payment info
    paymentMethod?: string | null;
    payments: Array<{
        id: string;
        amount: number;
        method: string;
        status: string;
        paidAt?: string | null;
    }>;
    // Timeline
    createdAt: string;
    updatedAt: string;
    // Human-readable status message
    statusMessage: string;
    statusDetail?: string;
    // Time in stage (ms)
    timeInStage: number;
}

interface PipelineSummary {
    cobrado: { count: number; total: number };
    facturar: { count: number; total: number };
    enAfip: { count: number; total: number };
    enviada: { count: number; total: number };
    cerrado: { count: number; total: number };
    // Global stats
    totalPendiente: number;
    totalFacturado: number;
    totalCobrado: number;
    afipConfigured: boolean;
    afipErrors: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE DETERMINATION
// ═══════════════════════════════════════════════════════════════════════════════

function getHumanStatusMessage(stage: PipelineStage, invoice: any): { message: string; detail?: string } {
    switch (stage) {
        case 'COBRADO':
            return {
                message: 'Cobro recibido',
                detail: 'Falta crear la factura para este trabajo',
            };
        case 'FACTURAR':
            return {
                message: 'Borrador listo',
                detail: 'Revisá y enviá a AFIP para obtener el CAE',
            };
        case 'EN_AFIP':
            return {
                message: 'Procesando en AFIP',
                detail: 'Se está gestionando el CAE automáticamente. Puede tardar unos minutos.',
            };
        case 'ENVIADA':
            return {
                message: 'Factura autorizada',
                detail: invoice?.afipCae
                    ? `CAE: ${invoice.afipCae}`
                    : 'La factura fue enviada al cliente',
            };
        case 'CERRADO':
            return {
                message: 'Cerrado ✓',
                detail: 'Factura pagada y conciliada',
            };
        default:
            return { message: 'Estado desconocido' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

        // Check module access — billing is Owner-only (same as invoices/payments)
        if (!canAccessModule('invoices', userRole)) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para ver facturación' },
                { status: 403 }
            );
        }

        const orgId = session.organizationId;

        const { searchParams } = new URL(request.url);
        const filterStage = searchParams.get('stage');
        const dateFrom = searchParams.get('from');
        const dateTo = searchParams.get('to');

        // Build date range
        const dateFilter: any = {};
        if (dateFrom) dateFilter.gte = new Date(dateFrom);
        if (dateTo) dateFilter.lte = new Date(dateTo);
        const hasDateFilter = Object.keys(dateFilter).length > 0;

        // ─────────────────────────────────────────────────────────────────────────
        // 1. Fetch all data in parallel
        // ─────────────────────────────────────────────────────────────────────────
        const [
            completedJobsWithoutInvoice,
            invoicesWithDetails,
            orgSettings,
        ] = await Promise.all([
            // Jobs that are COMPLETED but have NO invoice (Stage: COBRADO)
            // The Invoice model has `jobId @unique` pointing to Job, so we use
            // the reverse relation filter `invoice: null` on the Job model.
            prisma.job.findMany({
                where: {
                    organizationId: orgId,
                    status: 'COMPLETED',
                    invoice: { is: null },
                    ...(hasDateFilter ? { completedAt: dateFilter } : {}),
                },
                select: {
                    id: true,
                    jobNumber: true,
                    serviceType: true,
                    completedAt: true,
                    finalTotal: true,
                    estimatedTotal: true,
                    paymentMethod: true,
                    paymentAmount: true,
                    customerId: true,
                    customer: { select: { id: true, name: true, phone: true } },
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { completedAt: 'desc' },
                take: 200,
            }),

            // All invoices with payments and job info
            prisma.invoice.findMany({
                where: {
                    organizationId: orgId,
                    ...(hasDateFilter ? { createdAt: dateFilter } : {}),
                },
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    job: { select: { id: true, jobNumber: true, serviceType: true, completedAt: true } },
                    payments: {
                        select: {
                            id: true,
                            amount: true,
                            method: true,
                            status: true,
                            paidAt: true,
                        },
                    },
                    lineItems: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 500,
            }),

            // Check AFIP configuration
            prisma.organization.findUnique({
                where: { id: orgId },
                select: {
                    afipCertificateEncrypted: true,
                    afipCuit: true,
                    afipPuntoVenta: true,
                    afipEnvironment: true,
                },
            }),
        ]);

        const afipConfigured = !!(
            orgSettings?.afipCertificateEncrypted &&
            orgSettings?.afipCuit &&
            orgSettings?.afipPuntoVenta
        );

        // ─────────────────────────────────────────────────────────────────────────
        // 2. Build pipeline items
        // ─────────────────────────────────────────────────────────────────────────
        const pipelineItems: PipelineItem[] = [];
        const now = Date.now();

        // Stage 1: COBRADO — completed jobs without invoices
        for (const job of completedJobsWithoutInvoice) {
            const total = Number(job.finalTotal || job.estimatedTotal || 0);
            const stage: PipelineStage = 'COBRADO';
            const { message, detail } = getHumanStatusMessage(stage, null);

            if (filterStage && filterStage !== stage) continue;

            pipelineItems.push({
                id: `job-${job.id}`,
                stage,
                jobId: job.id,
                jobNumber: job.jobNumber,
                serviceType: job.serviceType,
                completedAt: job.completedAt?.toISOString() || null,
                customerId: job.customer.id,
                customerName: job.customer.name,
                customerPhone: job.customer.phone,
                invoiceId: null,
                invoiceNumber: null,
                invoiceType: null,
                invoiceStatus: null,
                subtotal: total,
                taxAmount: 0,
                total,
                totalPaid: Number(job.paymentAmount || 0),
                balance: total - Number(job.paymentAmount || 0),
                afipCae: null,
                afipCaeExpiry: null,
                afipQrCode: null,
                paymentMethod: job.paymentMethod,
                payments: [],
                createdAt: job.createdAt.toISOString(),
                updatedAt: job.updatedAt.toISOString(),
                statusMessage: message,
                statusDetail: detail,
                timeInStage: now - (job.completedAt?.getTime() || job.updatedAt.getTime()),
            });
        }

        // Stages 2-5: Invoice-based stages
        for (const invoice of invoicesWithDetails) {
            const totalPaid = invoice.payments
                .filter((p: any) => p.status === 'COMPLETED')
                .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
            const total = Number(invoice.total);
            const balance = total - totalPaid;

            // Determine stage from invoice status
            let stage: PipelineStage;
            switch (invoice.status) {
                case 'DRAFT':
                    stage = 'FACTURAR';
                    break;
                case 'PENDING':
                    stage = 'EN_AFIP';
                    break;
                case 'SENT':
                case 'OVERDUE':
                    stage = 'ENVIADA';
                    break;
                case 'PAID':
                    stage = 'CERRADO';
                    break;
                case 'CANCELLED':
                    continue; // Skip cancelled invoices
                default:
                    stage = 'FACTURAR';
            }

            if (filterStage && filterStage !== stage) continue;

            const { message, detail } = getHumanStatusMessage(stage, invoice);

            pipelineItems.push({
                id: `inv-${invoice.id}`,
                stage,
                jobId: invoice.job?.id || null,
                jobNumber: invoice.job?.jobNumber || null,
                serviceType: invoice.job?.serviceType || null,
                completedAt: invoice.job?.completedAt?.toISOString() || null,
                customerId: invoice.customer.id,
                customerName: invoice.customer.name,
                customerPhone: invoice.customer.phone,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                invoiceType: invoice.type,
                invoiceStatus: invoice.status,
                subtotal: Number(invoice.subtotal),
                taxAmount: Number(invoice.taxAmount),
                total,
                totalPaid,
                balance,
                afipCae: invoice.afipCae,
                afipCaeExpiry: invoice.afipCaeExpiry?.toISOString() || null,
                afipQrCode: invoice.afipQrCode,
                paymentMethod: invoice.payments[0]?.method || null,
                payments: invoice.payments.map((p: any) => ({
                    id: p.id,
                    amount: Number(p.amount),
                    method: p.method,
                    status: p.status,
                    paidAt: p.paidAt?.toISOString() || null,
                })),
                createdAt: invoice.createdAt.toISOString(),
                updatedAt: invoice.updatedAt.toISOString(),
                statusMessage: message,
                statusDetail: detail,
                timeInStage: now - invoice.updatedAt.getTime(),
            });
        }

        // ─────────────────────────────────────────────────────────────────────────
        // 3. Build summary
        // ─────────────────────────────────────────────────────────────────────────
        const summary: PipelineSummary = {
            cobrado: { count: 0, total: 0 },
            facturar: { count: 0, total: 0 },
            enAfip: { count: 0, total: 0 },
            enviada: { count: 0, total: 0 },
            cerrado: { count: 0, total: 0 },
            totalPendiente: 0,
            totalFacturado: 0,
            totalCobrado: 0,
            afipConfigured,
            afipErrors: 0,
        };

        for (const item of pipelineItems) {
            switch (item.stage) {
                case 'COBRADO':
                    summary.cobrado.count++;
                    summary.cobrado.total += item.total;
                    summary.totalPendiente += item.total;
                    break;
                case 'FACTURAR':
                    summary.facturar.count++;
                    summary.facturar.total += item.total;
                    summary.totalPendiente += item.total;
                    break;
                case 'EN_AFIP':
                    summary.enAfip.count++;
                    summary.enAfip.total += item.total;
                    summary.totalFacturado += item.total;
                    break;
                case 'ENVIADA':
                    summary.enviada.count++;
                    summary.enviada.total += item.total;
                    summary.totalFacturado += item.total;
                    break;
                case 'CERRADO':
                    summary.cerrado.count++;
                    summary.cerrado.total += item.total;
                    summary.totalCobrado += item.totalPaid;
                    break;
            }
        }

        // Sort items: by stage order, then oldest first (most urgent)
        pipelineItems.sort((a, b) => {
            const stageOrder: Record<PipelineStage, number> = {
                COBRADO: 0, FACTURAR: 1, EN_AFIP: 2, ENVIADA: 3, CERRADO: 4,
            };
            if (stageOrder[a.stage] !== stageOrder[b.stage]) {
                return stageOrder[a.stage] - stageOrder[b.stage];
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        return NextResponse.json({
            success: true,
            data: {
                items: pipelineItems,
                summary,
            },
        });
    } catch (error) {
        console.error('Billing pipeline error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al cargar el pipeline de facturación' },
            { status: 500 }
        );
    }
}
