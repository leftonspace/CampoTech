/**
 * Job Line Items API Route
 * 
 * GET /api/jobs/[id]/line-items - List all line items for a job
 * POST /api/jobs/[id]/line-items - Add a line item to a job
 * 
 * Used for pricebook integration during job editing and quoting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/line-items
 * Returns all line items for a specific job
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id: jobId } = await context.params;

        // Verify job belongs to user's organization
        const job = await prisma.job.findFirst({
            where: {
                id: jobId,
                organizationId: session.organizationId,
            },
            select: { id: true },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        // Fetch line items with price item details
        const lineItems = await prisma.jobLineItem.findMany({
            where: { jobId },
            include: {
                priceItem: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        specialty: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Calculate totals
        const subtotal = lineItems.reduce(
            (sum: number, item: typeof lineItems[number]) => sum + Number(item.total),
            0
        );
        const tax = lineItems.reduce(
            (sum: number, item: typeof lineItems[number]) => sum + Number(item.taxAmount || 0),
            0
        );
        const total = subtotal + tax;

        return NextResponse.json({
            success: true,
            data: {
                items: lineItems.map((item: typeof lineItems[number]) => ({
                    id: item.id,
                    priceItemId: item.priceItemId,
                    description: item.description,
                    quantity: Number(item.quantity),
                    unit: item.unit,
                    unitPrice: Number(item.unitPrice),
                    total: Number(item.total),
                    taxRate: Number(item.taxRate),
                    taxAmount: Number(item.taxAmount || 0),
                    notes: item.notes,
                    source: item.source,
                    jobVisitId: item.jobVisitId,
                    priceItem: item.priceItem,
                    createdBy: item.createdBy,
                    createdAt: item.createdAt,
                })),
                summary: {
                    subtotal,
                    tax,
                    total,
                    itemCount: lineItems.length,
                },
            },
        });
    } catch (error) {
        console.error('[API] Error fetching line items:', error);
        return NextResponse.json(
            { success: false, error: 'Error al cargar items' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/jobs/[id]/line-items
 * Add a new line item to a job (from pricebook or manual)
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id: jobId } = await context.params;
        const body = await request.json();

        // Verify job belongs to user's organization and is not locked
        const job = await prisma.job.findFirst({
            where: {
                id: jobId,
                organizationId: session.organizationId,
            },
            select: {
                id: true,
                pricingLockedAt: true,
                status: true,
            },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        // Check if pricing is locked (AFIP compliance)
        if (job.pricingLockedAt) {
            return NextResponse.json(
                { success: false, error: 'El precio está bloqueado (ya se generó factura)' },
                { status: 403 }
            );
        }

        // If adding from pricebook, fetch the price item
        let priceItem = null;
        if (body.priceItemId) {
            priceItem = await prisma.priceItem.findFirst({
                where: {
                    id: body.priceItemId,
                    organizationId: session.organizationId,
                    isActive: true,
                },
            });

            if (!priceItem) {
                return NextResponse.json(
                    { success: false, error: 'Item de catálogo no encontrado' },
                    { status: 404 }
                );
            }
        }

        // Calculate values
        const quantity = new Decimal(body.quantity || 1);
        const unitPrice = new Decimal(
            body.unitPrice ?? priceItem?.price ?? 0
        );
        const total = quantity.mul(unitPrice);
        const taxRate = new Decimal(body.taxRate ?? priceItem?.taxRate ?? 21);
        const taxAmount = total.mul(taxRate).div(100);

        // Create the line item
        const lineItem = await prisma.jobLineItem.create({
            data: {
                jobId,
                priceItemId: body.priceItemId || null,
                description: body.description || priceItem?.name || 'Item',
                quantity,
                unit: body.unit || priceItem?.unit || 'unidad',
                unitPrice,
                total,
                taxRate,
                taxAmount,
                notes: body.notes || null,
                source: body.source || 'QUOTE',
                jobVisitId: body.jobVisitId || null,
                createdById: session.userId,
            },
            include: {
                priceItem: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                    },
                },
            },
        });

        // Update job estimated total
        await updateJobEstimatedTotal(jobId);

        return NextResponse.json({
            success: true,
            data: {
                id: lineItem.id,
                priceItemId: lineItem.priceItemId,
                description: lineItem.description,
                quantity: Number(lineItem.quantity),
                unit: lineItem.unit,
                unitPrice: Number(lineItem.unitPrice),
                total: Number(lineItem.total),
                taxRate: Number(lineItem.taxRate),
                taxAmount: Number(lineItem.taxAmount),
                notes: lineItem.notes,
                priceItem: lineItem.priceItem,
            },
        });
    } catch (error) {
        console.error('[API] Error creating line item:', error);
        return NextResponse.json(
            { success: false, error: 'Error al crear item' },
            { status: 500 }
        );
    }
}

/**
 * Helper to recalculate and update job's estimated total from line items
 */
async function updateJobEstimatedTotal(jobId: string) {
    const lineItems = await prisma.jobLineItem.findMany({
        where: { jobId },
        select: { total: true, taxAmount: true },
    });

    const estimatedTotal = lineItems.reduce(
        (sum: number, item: typeof lineItems[number]) => sum + Number(item.total) + Number(item.taxAmount || 0),
        0
    );

    await prisma.job.update({
        where: { id: jobId },
        data: { estimatedTotal: new Decimal(estimatedTotal) },
    });
}
