/**
 * Pricebook Bulk Adjustment API
 * 
 * Phase 5 - Dynamic Pricing (Jan 2026)
 * 
 * POST /api/settings/pricebook/adjust - Apply inflation adjustment to multiple price items
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { applySmartRounding, RoundingStrategy, RoundingDirection } from '@/lib/services/smart-rounding';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AdjustmentRequest {
    indexSource: string;
    indexPeriod: string;
    indexRate: number;
    extraPercent: number;
    scope: 'all' | 'services' | 'products' | 'specialty';
    specialtyFilter?: string;
    typeFilter?: 'service' | 'product' | 'all';
    roundingStrategy: string;
    roundingDirection: string;
    itemIds: string[];
    notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Apply Bulk Adjustment
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Only OWNER and ADMIN can adjust prices
        if (!['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
            return NextResponse.json(
                { success: false, error: 'Only owners and admins can adjust prices' },
                { status: 403 }
            );
        }

        const body: AdjustmentRequest = await request.json();
        const {
            indexSource,
            indexPeriod,
            indexRate,
            extraPercent = 0,
            scope,
            specialtyFilter,
            roundingStrategy = 'ROUND_500',
            roundingDirection = 'NEAREST',
            itemIds,
            notes,
        } = body;

        // Validate required fields
        if (!indexSource || !indexPeriod || indexRate === undefined || !itemIds?.length) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate itemIds belong to this organization
        const priceItems = await prisma.priceItem.findMany({
            where: {
                id: { in: itemIds },
                organizationId: session.organizationId,
                isActive: true,
            },
        });

        if (priceItems.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No valid price items found' },
                { status: 400 }
            );
        }

        // Calculate total adjustment rate
        const totalRate = indexRate + extraPercent;
        const multiplier = 1 + totalRate / 100;

        // Track changes for audit and response
        const adjustedItems: Array<{
            id: string;
            name: string;
            originalPrice: number;
            newPrice: number;
            percentChange: number;
        }> = [];

        let totalValueBefore = new Decimal(0);
        let totalValueAfter = new Decimal(0);

        // Process each item in a transaction
        await prisma.$transaction(async (tx) => {
            for (const item of priceItems) {
                const originalPrice = item.price;
                const priceNum = originalPrice.toNumber();

                // Apply adjustment with smart rounding
                const beforeRounding = priceNum * multiplier;
                const newPrice = applySmartRounding(
                    beforeRounding,
                    roundingStrategy as RoundingStrategy,
                    roundingDirection as RoundingDirection
                );

                const percentChange = ((newPrice.toNumber() - priceNum) / priceNum) * 100;

                // Update the price item
                await tx.priceItem.update({
                    where: { id: item.id },
                    data: {
                        price: newPrice,
                        lastAdjustedAt: new Date(),
                    },
                });

                // Create history entry
                await tx.priceItemHistory.create({
                    data: {
                        priceItemId: item.id,
                        previousPrice: originalPrice,
                        newPrice: newPrice,
                        changeReason: 'INFLATION_AUTO',
                        changePercent: new Decimal(percentChange),
                        indexSource,
                        indexPeriod,
                        indexRate: new Decimal(totalRate),
                        changedById: session.userId,
                        notes: notes || `Ajuste por ${indexSource} ${indexPeriod}: ${totalRate.toFixed(1)}%`,
                    },
                });

                adjustedItems.push({
                    id: item.id,
                    name: item.name,
                    originalPrice: priceNum,
                    newPrice: newPrice.toNumber(),
                    percentChange,
                });

                totalValueBefore = totalValueBefore.add(originalPrice);
                totalValueAfter = totalValueAfter.add(newPrice);
            }

            // Create adjustment event for audit trail
            await tx.priceAdjustmentEvent.create({
                data: {
                    organizationId: session.organizationId,
                    indexSource: indexSource as 'CAC_ICC_GENERAL' | 'CAC_ICC_MANO_OBRA' | 'CAC_ICC_MATERIALES' | 'INDEC_IPC' | 'INDEC_IPC_VIVIENDA' | 'CUSTOM',
                    indexPeriod,
                    indexRate: new Decimal(indexRate),
                    extraPercent: new Decimal(extraPercent),
                    totalAdjustment: new Decimal(totalRate),
                    adjustmentType: scope === 'all' ? 'ALL' : scope.toUpperCase() as 'ALL' | 'SERVICES' | 'PRODUCTS' | 'BY_SPECIALTY',
                    specialtyFilter: specialtyFilter || null,
                    itemsAffected: adjustedItems.length,
                    totalValueBefore,
                    totalValueAfter,
                    appliedById: session.userId,
                    notes: notes || `Ajuste ${indexSource} ${indexPeriod}`,
                },
            });

            // Update org pricing settings with last check time
            await tx.organizationPricingSettings.upsert({
                where: { organizationId: session.organizationId },
                update: { lastInflationCheck: new Date() },
                create: {
                    organizationId: session.organizationId,
                    lastInflationCheck: new Date(),
                },
            });
        });

        console.log(`[Pricebook Adjust] Applied ${totalRate.toFixed(1)}% to ${adjustedItems.length} items for org ${session.organizationId}`);

        return NextResponse.json({
            success: true,
            data: {
                itemsAdjusted: adjustedItems.length,
                indexApplied: {
                    source: indexSource,
                    period: indexPeriod,
                    rate: indexRate,
                    extra: extraPercent,
                    total: totalRate,
                },
                summary: {
                    totalBefore: totalValueBefore.toNumber(),
                    totalAfter: totalValueAfter.toNumber(),
                    averageChange: adjustedItems.length > 0
                        ? adjustedItems.reduce((sum, i) => sum + i.percentChange, 0) / adjustedItems.length
                        : 0,
                },
                adjustedItems: adjustedItems.slice(0, 10), // Return first 10 for confirmation
            },
        });
    } catch (error) {
        console.error('[Pricebook Adjust] POST error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to apply adjustment',
            },
            { status: 500 }
        );
    }
}
