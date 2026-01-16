/**
 * Apply Voice-Invoice Line Items API
 * ===================================
 * 
 * Phase 6: Takes approved line items and creates actual JobLineItem records
 * 
 * POST /api/jobs/[id]/voice-invoice/apply
 * - Takes reviewed line items from technician
 * - Creates JobLineItem records in database
 * - Updates job totals
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

// =============================================================================
// VALIDATION
// =============================================================================

const lineItemSchema = z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().default('unidad'),
    unitPrice: z.number().min(0),
    priceItemId: z.string().optional().nullable(),
    sourceType: z.enum(['part', 'service', 'custom']).default('custom'),
    taxRate: z.number().default(21.0),
});

const requestSchema = z.object({
    lineItems: z.array(lineItemSchema).min(1, 'Se requiere al menos un item'),
    jobSummary: z.string().optional(),
    workPerformed: z.string().optional(),
    equipmentStatus: z.enum(['funcionando', 'requiere_seguimiento', 'no_reparable']).optional(),
    followUpRequired: z.boolean().default(false),
    voiceMemoUrl: z.string().optional(),
    transcription: z.string().optional(),
});

// =============================================================================
// POST - Apply approved line items
// =============================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authenticate
        const session = await getSession();
        if (!session?.userId || !session.organizationId) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id: jobId } = await params;

        // Verify job exists and belongs to organization
        const job = await prisma.job.findFirst({
            where: {
                id: jobId,
                organizationId: session.organizationId,
            },
            include: {
                lineItems: true,
            },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        // Parse and validate request
        const body = await request.json();
        const validationResult = requestSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Datos inválidos',
                    details: validationResult.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const {
            lineItems,
            jobSummary,
            workPerformed,
        } = validationResult.data;

        // Create line items in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create the line items
            const createdItems = await Promise.all(
                lineItems.map(async (item, index) => {
                    const total = new Decimal(item.quantity).mul(new Decimal(item.unitPrice));
                    const taxAmount = total.mul(new Decimal(item.taxRate)).div(100);

                    return tx.jobLineItem.create({
                        data: {
                            jobId,
                            priceItemId: item.priceItemId || null,
                            description: item.description,
                            quantity: new Decimal(item.quantity),
                            unit: item.unit,
                            unitPrice: new Decimal(item.unitPrice),
                            total,
                            taxRate: new Decimal(item.taxRate),
                            taxAmount,
                            source: `voice_invoice_${item.sourceType}`,
                            createdById: session.userId,
                            sortOrder: index,
                        },
                    });
                })
            );

            // Calculate new job totals
            const allLineItems = await tx.jobLineItem.findMany({
                where: { jobId },
            });

            const subtotal = allLineItems.reduce(
                (sum: Decimal, item: typeof allLineItems[number]) => sum.add(item.total),
                new Decimal(0)
            );
            const taxTotal = allLineItems.reduce(
                (sum: Decimal, item: typeof allLineItems[number]) => sum.add(item.taxAmount || new Decimal(0)),
                new Decimal(0)
            );
            const total = subtotal.add(taxTotal);

            // Update job with new totals and completion info
            const updatedJob = await tx.job.update({
                where: { id: jobId },
                data: {
                    // Update totals
                    techProposedTotal: total,
                    // Store voice invoice metadata in notes or a JSON field
                    notes: job.notes
                        ? `${job.notes}\n\n--- Reporte de Voz (${new Date().toLocaleString('es-AR')}) ---\n${jobSummary || workPerformed || ''}`
                        : `--- Reporte de Voz (${new Date().toLocaleString('es-AR')}) ---\n${jobSummary || workPerformed || ''}`,
                },
            });

            return {
                lineItems: createdItems,
                job: updatedJob,
                totals: {
                    subtotal: subtotal.toNumber(),
                    taxTotal: taxTotal.toNumber(),
                    total: total.toNumber(),
                },
            };
        });

        return NextResponse.json({
            success: true,
            message: `Se crearon ${result.lineItems.length} items de facturación`,
            lineItemCount: result.lineItems.length,
            totals: result.totals,
        });
    } catch (error) {
        console.error('Apply voice-invoice error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al aplicar los items' },
            { status: 500 }
        );
    }
}
