/**
 * Exchange Rate History API
 * 
 * Phase 3 - Dynamic Pricing (Jan 2026)
 * 
 * GET /api/exchange-rates/history - Get rate history for charting
 * GET /api/exchange-rates/history?source=BLUE&days=7 - Filter by source and period
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getRateHistory,
    getRateStats,
    ExchangeRateSource,
} from '@/lib/services/exchange-rate.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_SOURCES: ExchangeRateSource[] = ['OFICIAL', 'BLUE', 'MEP', 'CCL', 'CRYPTO', 'CUSTOM'];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sourceParam = searchParams.get('source')?.toUpperCase();
        const daysParam = searchParams.get('days');
        const includeStats = searchParams.get('stats') === 'true';

        // Validate source if provided
        const source = sourceParam && VALID_SOURCES.includes(sourceParam as ExchangeRateSource)
            ? (sourceParam as ExchangeRateSource)
            : undefined;

        // Parse days (default 30, max 90)
        const days = Math.min(parseInt(daysParam || '30', 10) || 30, 90);

        // Get history
        const history = await getRateHistory({
            source,
            days,
            limit: 500,
        });

        // Group by source for charting
        const groupedHistory: Record<string, typeof history> = {};
        for (const entry of history) {
            if (!groupedHistory[entry.source]) {
                groupedHistory[entry.source] = [];
            }
            groupedHistory[entry.source].push(entry);
        }

        // Get stats if requested
        let stats = null;
        if (includeStats && source) {
            stats = await getRateStats(source, days);
        }

        // Format for chart consumption
        const chartData = Object.entries(groupedHistory).map(([src, entries]) => ({
            source: src,
            label: getSourceLabel(src as ExchangeRateSource),
            data: entries.map(e => ({
                date: e.fetchedAt.toISOString(),
                buy: e.buyRate,
                sell: e.sellRate,
                avg: e.averageRate,
            })),
        }));

        return NextResponse.json({
            success: true,
            data: {
                history: chartData,
                stats,
                meta: {
                    source,
                    days,
                    totalRecords: history.length,
                    sources: Object.keys(groupedHistory),
                },
            },
        });
    } catch (error) {
        console.error('[Rate History] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get rate history',
            },
            { status: 500 }
        );
    }
}

function getSourceLabel(source: ExchangeRateSource): string {
    const labels: Record<ExchangeRateSource, string> = {
        OFICIAL: 'Dólar Oficial',
        BLUE: 'Cotización de Mercado',
        MEP: 'Dólar MEP',
        CCL: 'Dólar CCL',
        CRYPTO: 'Crypto (USDT)',
        CUSTOM: 'Personalizado',
    };
    return labels[source] || source;
}
