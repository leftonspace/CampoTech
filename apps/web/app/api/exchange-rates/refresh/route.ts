/**
 * Exchange Rate Refresh API
 * 
 * Phase 1 - Dynamic Pricing Foundation (Jan 2026)
 * 
 * POST /api/exchange-rates/refresh - Force refresh all rates
 * 
 * Requires authentication (admin/owner)
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { refreshAllRates, getAllExchangeRates, EXCHANGE_RATE_LABELS } from '@/lib/services/exchange-rate.service';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        // Check authentication
        const session = await requireAuth();

        if (!session?.userId) {
            return NextResponse.json(
                { success: false, error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Refresh all rates
        await refreshAllRates();

        // Get updated rates
        const rates = await getAllExchangeRates();

        const formatted = rates.map(rate => ({
            source: rate.source,
            label: EXCHANGE_RATE_LABELS[rate.source],
            buyRate: rate.buyRate.toNumber(),
            sellRate: rate.sellRate.toNumber(),
            averageRate: rate.averageRate.toNumber(),
            fetchedAt: rate.fetchedAt.toISOString(),
            isStale: rate.isStale,
        }));

        return NextResponse.json({
            success: true,
            message: 'Exchange rates refreshed successfully',
            data: formatted,
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Failed to refresh exchange rates:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to refresh exchange rates',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
