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

        // Validate exchange rate source
        const validSources = ['OFICIAL', 'BLUE', 'MEP', 'CCL', 'CRYPTO', 'CUSTOM'];
        if (body.exchangeRateSource && !validSources.includes(body.exchangeRateSource)) {
            return NextResponse.json(
                { success: false, error: 'Invalid exchange rate source' },
                { status: 400 }
            );
        }

        // Validate rounding strategy
        const validStrategies = ['NO_ROUNDING', 'ROUND_100', 'ROUND_500', 'ROUND_1000', 'ROUND_5000'];
        if (body.roundingStrategy && !validStrategies.includes(body.roundingStrategy)) {
            return NextResponse.json(
                { success: false, error: 'Invalid rounding strategy' },
                { status: 400 }
            );
        }

        // Validate rounding direction
        const validDirections = ['NEAREST', 'UP', 'DOWN'];
        if (body.roundingDirection && !validDirections.includes(body.roundingDirection)) {
            return NextResponse.json(
                { success: false, error: 'Invalid rounding direction' },
                { status: 400 }
            );
        }

        // Upsert settings
        const settings = await prisma.organizationPricingSettings.upsert({
            where: { organizationId: session.organizationId },
            update: {
                exchangeRateSource: body.exchangeRateSource,
                exchangeRateMarkup: body.exchangeRateMarkup,
                autoUpdateExchangeRate: body.autoUpdateExchangeRate,
                roundingStrategy: body.roundingStrategy,
                roundingDirection: body.roundingDirection,
                autoUpdateThreshold: body.autoUpdateThreshold,
                // Reset anchor if source changes
                ...(body.exchangeRateSource && {
                    anchorExchangeRate: null,
                    anchorSetAt: null,
                }),
                updatedAt: new Date(),
            },
            create: {
                organizationId: session.organizationId,
                exchangeRateSource: body.exchangeRateSource || 'BLUE',
                exchangeRateMarkup: body.exchangeRateMarkup || 0,
                autoUpdateExchangeRate: body.autoUpdateExchangeRate ?? true,
                roundingStrategy: body.roundingStrategy || 'ROUND_500',
                roundingDirection: body.roundingDirection || 'NEAREST',
                autoUpdateThreshold: body.autoUpdateThreshold || 5,
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
