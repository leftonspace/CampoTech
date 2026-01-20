/**
 * Pricebook History API
 * 
 * Phase 5 - Dynamic Pricing (Jan 2026)
 * 
 * GET /api/settings/pricebook/history - Get price adjustment history for audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await requireAuth();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const limit = Math.min(parseInt(limitParam || '20', 10) || 20, 100);

        // Get price adjustment events for this organization
        const events = await prisma.priceAdjustmentEvent.findMany({
            where: {
                organizationId: session.organizationId,
            },
            include: {
                appliedBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                appliedAt: 'desc',
            },
            take: limit,
        });

        return NextResponse.json({
            success: true,
            data: {
                events: events.map((e: typeof events[0]) => ({
                    id: e.id,
                    indexSource: e.indexSource,
                    indexPeriod: e.indexPeriod,
                    indexRate: e.indexRate.toNumber(),
                    extraPercent: e.extraPercent.toNumber(),
                    totalAdjustment: e.totalAdjustment.toNumber(),
                    adjustmentType: e.adjustmentType,
                    specialtyFilter: e.specialtyFilter,
                    itemsAffected: e.itemsAffected,
                    totalValueBefore: e.totalValueBefore.toNumber(),
                    totalValueAfter: e.totalValueAfter.toNumber(),
                    appliedAt: e.appliedAt.toISOString(),
                    appliedBy: e.appliedBy,
                    notes: e.notes,
                })),
            },
        });
    } catch (error) {
        console.error('[Pricebook History] GET error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch history',
            },
            { status: 500 }
        );
    }
}
