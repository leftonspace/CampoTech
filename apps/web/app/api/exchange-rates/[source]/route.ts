/**
 * Exchange Rate by Source API
 * 
 * Phase 1 - Dynamic Pricing Foundation (Jan 2026)
 * 
 * GET /api/exchange-rates/[source] - Get rate for specific source
 * 
 * Params:
 * - source: OFICIAL | BLUE | MEP | CCL | CRYPTO | CUSTOM
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getExchangeRate,
    EXCHANGE_RATE_LABELS,
    ExchangeRateSource,
} from '@/lib/services/exchange-rate.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_SOURCES: ExchangeRateSource[] = [
    'OFICIAL',
    'BLUE',
    'MEP',
    'CCL',
    'CRYPTO',
    'CUSTOM',
];

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ source: string }> }
) {
    try {
        const { source: sourceParam } = await params;
        const source = sourceParam?.toUpperCase() as ExchangeRateSource;

        // Validate source
        if (!source || !VALID_SOURCES.includes(source)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid source',
                    validSources: VALID_SOURCES,
                },
                { status: 400 }
            );
        }

        const rate = await getExchangeRate(source);

        return NextResponse.json({
            success: true,
            data: {
                source: rate.source,
                label: EXCHANGE_RATE_LABELS[rate.source],
                buyRate: rate.buyRate.toNumber(),
                sellRate: rate.sellRate.toNumber(),
                averageRate: rate.averageRate.toNumber(),
                fetchedAt: rate.fetchedAt.toISOString(),
                validUntil: rate.validUntil.toISOString(),
                isStale: rate.isStale,
                // Formatted for display
                display: {
                    buy: `$${rate.buyRate.toNumber().toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                    sell: `$${rate.sellRate.toNumber().toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                    average: `$${rate.averageRate.toNumber().toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                },
            },
        });
    } catch (error) {
        console.error('Failed to get exchange rate:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch exchange rate',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
