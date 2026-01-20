/**
 * Exchange Rate Cron Job
 * 
 * Phase 3 - Dynamic Pricing (Jan 2026)
 * 
 * POST /api/cron/exchange-rates
 * 
 * Runs hourly to refresh exchange rates from all sources.
 * Protected by CRON_SECRET to prevent unauthorized execution.
 * 
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/exchange-rates",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    refreshAllRatesWithRetry,
    cleanupOldRates,
    RefreshResult,
} from '@/lib/services/exchange-rate.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In development, allow without secret
    if (process.env.NODE_ENV === 'development' && !cronSecret) {
        return true;
    }

    if (!cronSecret) {
        console.warn('[Cron] CRON_SECRET not configured');
        return false;
    }

    return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
    // Verify authorization
    if (!verifyCronSecret(request)) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    const startTime = Date.now();
    console.log('[Cron] Starting exchange rate refresh...');

    try {
        // Refresh all rates with retry logic
        const results = await refreshAllRatesWithRetry();

        // Calculate success/failure counts
        const successCount = results.filter((r: RefreshResult) => r.success).length;
        const failureCount = results.filter((r: RefreshResult) => !r.success).length;

        // Cleanup old records monthly (on first day of month, hour 0)
        let cleanupCount = 0;
        const now = new Date();
        if (now.getDate() === 1 && now.getHours() === 0) {
            cleanupCount = await cleanupOldRates(30);
        }

        const duration = Date.now() - startTime;

        console.log(`[Cron] Exchange rate refresh complete in ${duration}ms: ${successCount} success, ${failureCount} failed`);

        return NextResponse.json({
            success: true,
            data: {
                results,
                summary: {
                    success: successCount,
                    failed: failureCount,
                    total: results.length,
                    durationMs: duration,
                    cleanedUp: cleanupCount,
                },
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('[Cron] Exchange rate refresh failed:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}

// Also allow GET for manual testing in dev
export async function GET(request: NextRequest) {
    // Only in development
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
            { success: false, error: 'Use POST method' },
            { status: 405 }
        );
    }

    return POST(request);
}
