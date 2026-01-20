/**
 * Manual Exchange Rate Override API
 * 
 * Phase 3 - Dynamic Pricing (Jan 2026)
 * 
 * POST /api/admin/exchange-rates/manual - Set a manual rate override
 * 
 * Only accessible by super_admin (CampoTech platform admins).
 * Used when scrapers fail and we need to manually set rates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

const VALID_SOURCES = ['OFICIAL', 'BLUE', 'MEP', 'CCL', 'CRYPTO', 'CUSTOM'];
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const EXCHANGE_RATE_LABELS: Record<string, string> = {
    OFICIAL: 'Dólar Oficial',
    BLUE: 'Cotización de Mercado',
    MEP: 'Dólar MEP',
    CCL: 'Dólar CCL',
    CRYPTO: 'Cotización Crypto',
    CUSTOM: 'Cotización Personalizada',
};

export async function POST(request: NextRequest) {
    try {
        const admin = await getAdminSession();
        if (!admin) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Only super_admin can set manual rates
        if (!hasPermission(admin, 'manage_admins')) {
            return NextResponse.json(
                { success: false, error: 'Only super admins can set manual rates' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { source, buyRate, sellRate, reason } = body;

        // Validate required fields
        if (!source || !buyRate || !sellRate) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing required fields: source, buyRate, sellRate',
                },
                { status: 400 }
            );
        }

        // Validate source
        const normalizedSource = source.toUpperCase();
        if (!VALID_SOURCES.includes(normalizedSource)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid source. Valid sources: ${VALID_SOURCES.join(', ')}`,
                },
                { status: 400 }
            );
        }

        // Validate rates are positive numbers
        const parsedBuyRate = parseFloat(buyRate);
        const parsedSellRate = parseFloat(sellRate);

        if (isNaN(parsedBuyRate) || parsedBuyRate <= 0) {
            return NextResponse.json(
                { success: false, error: 'buyRate must be a positive number' },
                { status: 400 }
            );
        }

        if (isNaN(parsedSellRate) || parsedSellRate <= 0) {
            return NextResponse.json(
                { success: false, error: 'sellRate must be a positive number' },
                { status: 400 }
            );
        }

        // Validate sell >= buy (typical market behavior)
        if (parsedSellRate < parsedBuyRate) {
            return NextResponse.json(
                { success: false, error: 'sellRate should be >= buyRate' },
                { status: 400 }
            );
        }

        const validUntil = new Date(Date.now() + CACHE_TTL_MS);
        const averageRate = (parsedBuyRate + parsedSellRate) / 2;

        // Set the manual rate
        const rate = await prisma.exchangeRate.create({
            data: {
                source: normalizedSource,
                buyRate: new Decimal(parsedBuyRate),
                sellRate: new Decimal(parsedSellRate),
                averageRate: new Decimal(averageRate),
                fetchedAt: new Date(),
                validUntil,
                isStale: false,
            },
        });

        console.log(`[Admin Manual Rate] Set by ${admin.email}: ${normalizedSource} = ${averageRate}`, {
            reason,
            buyRate: parsedBuyRate,
            sellRate: parsedSellRate,
        });

        return NextResponse.json({
            success: true,
            data: {
                id: rate.id,
                source: rate.source,
                label: EXCHANGE_RATE_LABELS[normalizedSource] || normalizedSource,
                buyRate: rate.buyRate.toNumber(),
                sellRate: rate.sellRate.toNumber(),
                averageRate: rate.averageRate.toNumber(),
                fetchedAt: rate.fetchedAt.toISOString(),
                validUntil: rate.validUntil.toISOString(),
                isManual: true,
                setBy: admin.email,
            },
        });
    } catch (error) {
        console.error('[Admin Manual Rate] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to set manual rate',
            },
            { status: 500 }
        );
    }
}
