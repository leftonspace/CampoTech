'use strict';

/**
 * Labor Rates API
 * 
 * Phase 6.2 - Technician Hourly Wages (Jan 2026)
 * 
 * Manages per-specialty per-category hourly rates for organizations.
 * Supports all 12 trades with their respective level systems.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { validateBody, laborRateBulkSchema, laborRateSchema } from '@/lib/validation/api-schemas';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface LaborRate {
    id?: string;
    specialty: string;
    category: string;
    hourlyRate: number;
    notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Fetch all labor rates for organization
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const session = await requireAuth();

        const rates = await prisma.organizationLaborRate.findMany({
            where: { organizationId: session.organizationId },
            orderBy: [
                { specialty: 'asc' },
                { category: 'asc' },
            ],
        });

        return NextResponse.json({
            success: true,
            data: rates,
        });
    } catch (error) {
        console.error('Error fetching labor rates:', error);
        return NextResponse.json(
            { success: false, error: 'Error al cargar tarifas' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create or update labor rate
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth();
        const body = await request.json() as LaborRate;

        // Validate request body with Zod
        const validation = validateBody(body, laborRateSchema);
        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: validation.error },
                { status: 400 }
            );
        }

        const { specialty, category, hourlyRate, notes } = validation.data;

        // Upsert - create if not exists, update if exists
        const rate = await prisma.organizationLaborRate.upsert({
            where: {
                organizationId_specialty_category: {
                    organizationId: session.organizationId,
                    specialty,
                    category,
                },
            },
            update: {
                hourlyRate,
                notes: notes || null,
            },
            create: {
                organizationId: session.organizationId,
                specialty,
                category,
                hourlyRate,
                notes: notes || null,
            },
        });

        return NextResponse.json({
            success: true,
            data: rate,
        });
    } catch (error) {
        console.error('Error saving labor rate:', error);
        return NextResponse.json(
            { success: false, error: 'Error al guardar tarifa' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT - Bulk update labor rates
// ═══════════════════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
    try {
        const session = await requireAuth();
        const body = await request.json() as { rates: LaborRate[] };

        // Validate request body with Zod
        const validation = validateBody(body, laborRateBulkSchema);
        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: validation.error },
                { status: 400 }
            );
        }

        const { rates } = validation.data;

        // Use transaction for bulk update
        const results = await prisma.$transaction(
            rates.map((rate) =>
                prisma.organizationLaborRate.upsert({
                    where: {
                        organizationId_specialty_category: {
                            organizationId: session.organizationId,
                            specialty: rate.specialty,
                            category: rate.category,
                        },
                    },
                    update: {
                        hourlyRate: rate.hourlyRate,
                        notes: rate.notes || null,
                    },
                    create: {
                        organizationId: session.organizationId,
                        specialty: rate.specialty,
                        category: rate.category,
                        hourlyRate: rate.hourlyRate,
                        notes: rate.notes || null,
                    },
                })
            )
        );

        return NextResponse.json({
            success: true,
            data: results,
            message: `${results.length} tarifas actualizadas`,
        });
    } catch (error) {
        console.error('Error bulk updating labor rates:', error);
        return NextResponse.json(
            { success: false, error: 'Error al actualizar tarifas' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Remove a labor rate
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest) {
    try {
        const session = await requireAuth();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID de tarifa requerido' },
                { status: 400 }
            );
        }

        // Verify ownership before delete
        const rate = await prisma.organizationLaborRate.findFirst({
            where: { id, organizationId: session.organizationId },
        });

        if (!rate) {
            return NextResponse.json(
                { success: false, error: 'Tarifa no encontrada' },
                { status: 404 }
            );
        }

        await prisma.organizationLaborRate.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'Tarifa eliminada',
        });
    } catch (error) {
        console.error('Error deleting labor rate:', error);
        return NextResponse.json(
            { success: false, error: 'Error al eliminar tarifa' },
            { status: 500 }
        );
    }
}
