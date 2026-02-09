/**
 * Pricing Settings API
 * 
 * Phase 2 - Dynamic Pricing UI (Jan 2026)
 * 
 * GET /api/settings/pricing - Get pricing settings
 * PUT /api/settings/pricing - Update pricing settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateBody, pricingSettingsSchema } from '@/lib/validation/api-schemas';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Fetch Pricing Settings
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const session = await requireAuth();

        // Get organization pricing settings
        const settings = await prisma.organizationPricingSettings.findUnique({
            where: { organizationId: session.organizationId },
            select: {
                defaultCurrency: true,
                exchangeRateSource: true,
                customExchangeRate: true,
                exchangeRateMarkup: true,
                exchangeRateLabel: true,
                autoUpdateExchangeRate: true,
                roundingStrategy: true,
                roundingDirection: true,
                autoUpdateThreshold: true,
                anchorExchangeRate: true,
                anchorSetAt: true,
                inflationIndexSource: true,
                autoInflationAdjust: true,
                inflationExtraPercent: true,
                lastInflationCheck: true,
            },
        });

        // Return defaults if no settings exist
        const defaultSettings = {
            defaultCurrency: 'ARS',
            exchangeRateSource: 'BLUE',
            customExchangeRate: null,
            exchangeRateMarkup: 0,
            exchangeRateLabel: null,
            autoUpdateExchangeRate: true,
            roundingStrategy: 'ROUND_500',
            roundingDirection: 'NEAREST',
            autoUpdateThreshold: 5,
            anchorExchangeRate: null,
            anchorSetAt: null,
            inflationIndexSource: null,
            autoInflationAdjust: false,
            inflationExtraPercent: 0,
            lastInflationCheck: null,
        };

        return NextResponse.json({
            success: true,
            data: settings ? {
                ...settings,
                // Convert Decimals to numbers for JSON
                customExchangeRate: settings.customExchangeRate?.toNumber() ?? null,
                exchangeRateMarkup: settings.exchangeRateMarkup?.toNumber() ?? 0,
                autoUpdateThreshold: settings.autoUpdateThreshold?.toNumber() ?? 5,
                anchorExchangeRate: settings.anchorExchangeRate?.toNumber() ?? null,
                inflationExtraPercent: settings.inflationExtraPercent?.toNumber() ?? 0,
            } : defaultSettings,
        });
    } catch (error) {
        console.error('[Pricing Settings GET] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch pricing settings' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT - Update Pricing Settings
// ═══════════════════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
    try {
        const session = await requireAuth();

        // Only OWNER can update pricing settings
        if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
            return NextResponse.json(
                { success: false, error: 'Insufficient permissions' },
                { status: 403 }
            );
        }

        const body = await request.json();

        // Validate request body with Zod
        const validation = validateBody(body, pricingSettingsSchema);
        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: validation.error },
                { status: 400 }
            );
        }

        const validData = validation.data;

        // Upsert settings
        const settings = await prisma.organizationPricingSettings.upsert({
            where: { organizationId: session.organizationId },
            update: {
                exchangeRateSource: validData.exchangeRateSource,
                exchangeRateMarkup: validData.exchangeRateMarkup,
                autoUpdateExchangeRate: validData.autoUpdateExchangeRate,
                roundingStrategy: validData.roundingStrategy,
                roundingDirection: validData.roundingDirection,
                autoUpdateThreshold: validData.autoUpdateThreshold,
                // Reset anchor if source changes
                ...(validData.exchangeRateSource && {
                    anchorExchangeRate: null,
                    anchorSetAt: null,
                }),
                updatedAt: new Date(),
            },
            create: {
                organizationId: session.organizationId,
                exchangeRateSource: validData.exchangeRateSource || 'BLUE',
                exchangeRateMarkup: validData.exchangeRateMarkup || 0,
                autoUpdateExchangeRate: validData.autoUpdateExchangeRate ?? true,
                roundingStrategy: validData.roundingStrategy || 'ROUND_500',
                roundingDirection: validData.roundingDirection || 'NEAREST',
                autoUpdateThreshold: validData.autoUpdateThreshold || 5,
            },
        });

        console.log('[Pricing Settings] Updated for org:', session.organizationId, {
            exchangeRateSource: settings.exchangeRateSource,
            roundingStrategy: settings.roundingStrategy,
        });

        return NextResponse.json({
            success: true,
            data: {
                ...settings,
                customExchangeRate: settings.customExchangeRate?.toNumber() ?? null,
                exchangeRateMarkup: settings.exchangeRateMarkup?.toNumber() ?? 0,
                autoUpdateThreshold: settings.autoUpdateThreshold?.toNumber() ?? 5,
                anchorExchangeRate: settings.anchorExchangeRate?.toNumber() ?? null,
                inflationExtraPercent: settings.inflationExtraPercent?.toNumber() ?? 0,
            },
        });
    } catch (error) {
        console.error('[Pricing Settings PUT] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update pricing settings' },
            { status: 500 }
        );
    }
}
