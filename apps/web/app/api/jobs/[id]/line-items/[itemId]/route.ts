/**
 * Individual Job Line Item API Route
 * 
 * PUT /api/jobs/[id]/line-items/[itemId] - Update a line item
 * DELETE /api/jobs/[id]/line-items/[itemId] - Remove a line item
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

/**
 * PUT /api/jobs/[id]/line-items/[itemId]
 * Update an existing line item (quantity, description, etc.)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id: jobId, itemId } = await context.params;
        const body = await request.json();

        // Verify job belongs to user's organization and is not locked
        const job = await prisma.job.findFirst({
            where: {
                id: jobId,
                organizationId: session.organizationId,
            },
            select: { id: true, pricingLockedAt: true },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        if (job.pricingLockedAt) {
            return NextResponse.json(
                { success: false, error: 'El precio está bloqueado (ya se generó factura)' },
                { status: 403 }
            );
        }

        // Verify line item exists
        const existingItem = await prisma.jobLineItem.findFirst({
            where: { id: itemId, jobId },
        });

        if (!existingItem) {
            return NextResponse.json(
                { success: false, error: 'Item no encontrado' },
                { status: 404 }
            );
        }

        // Calculate new values
        const quantity = body.quantity !== undefined
            ? new Decimal(body.quantity)
            : existingItem.quantity;
        const unitPrice = body.unitPrice !== undefined
            ? new Decimal(body.unitPrice)
            : existingItem.unitPrice;
        const total = quantity.mul(unitPrice);
        const taxRate = body.taxRate !== undefined
            ? new Decimal(body.taxRate)
            : existingItem.taxRate;
        const taxAmount = total.mul(taxRate).div(100);

        // Update the line item
        const lineItem = await prisma.jobLineItem.update({
            where: { id: itemId },
            data: {
                description: body.description !== undefined ? body.description : undefined,
                quantity,
                unit: body.unit !== undefined ? body.unit : undefined,
                unitPrice,
                total,
                taxRate,
                taxAmount,
                notes: body.notes !== undefined ? body.notes : undefined,
                jobVisitId: body.jobVisitId !== undefined ? body.jobVisitId : undefined,
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
        console.error('[API] Error updating line item:', error);
        return NextResponse.json(
            { success: false, error: 'Error al actualizar item' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/jobs/[id]/line-items/[itemId]
 * Remove a line item from a job
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id: jobId, itemId } = await context.params;

        // Verify job belongs to user's organization and is not locked
        const job = await prisma.job.findFirst({
            where: {
                id: jobId,
                organizationId: session.organizationId,
            },
            select: { id: true, pricingLockedAt: true },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        if (job.pricingLockedAt) {
            return NextResponse.json(
                { success: false, error: 'El precio está bloqueado (ya se generó factura)' },
                { status: 403 }
            );
        }

        // Verify line item exists
        const existingItem = await prisma.jobLineItem.findFirst({
            where: { id: itemId, jobId },
        });

        if (!existingItem) {
            return NextResponse.json(
                { success: false, error: 'Item no encontrado' },
                { status: 404 }
            );
        }

        // Delete the line item
        await prisma.jobLineItem.delete({
            where: { id: itemId },
        });

        // Update job estimated total
        await updateJobEstimatedTotal(jobId);

        return NextResponse.json({
            success: true,
            message: 'Item eliminado',
        });
    } catch (error) {
        console.error('[API] Error deleting line item:', error);
        return NextResponse.json(
            { success: false, error: 'Error al eliminar item' },
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
