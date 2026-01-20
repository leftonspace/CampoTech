/**
 * Exchange Rates API
 * 
 * Phase 1 - Dynamic Pricing Foundation (Jan 2026)
 * 
 * GET /api/exchange-rates - Get all current rates
 * 
 * Returns exchange rates from all sources (OFICIAL, BLUE, MEP)
 * with cache status and UI labels.
 */

import { NextResponse } from 'next/server';
import {
    getAllExchangeRates,
    EXCHANGE_RATE_LABELS
} from '@/lib/services/exchange-rate.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const rates = await getAllExchangeRates();

        // Format response with ARS formatting
        const formatted = rates.map(rate => ({
            source: rate.source,
            label: EXCHANGE_RATE_LABELS[rate.source],
            buyRate: rate.buyRate.toNumber(),
            sellRate: rate.sellRate.toNumber(),
            averageRate: rate.averageRate.toNumber(),
            fetchedAt: rate.fetchedAt.toISOString(),
            isStale: rate.isStale,
            // Formatted for display
            display: {
                buy: `$${rate.buyRate.toNumber().toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                sell: `$${rate.sellRate.toNumber().toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                average: `$${rate.averageRate.toNumber().toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
            },
        }));

        return NextResponse.json({
            success: true,
            data: formatted,
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Failed to get exchange rates:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch exchange rates',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
