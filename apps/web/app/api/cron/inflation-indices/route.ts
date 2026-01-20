/**
 * Inflation Index Cron Job API
 * 
 * Phase 5 - Dynamic Pricing (Jan 2026)
 * 
 * POST /api/cron/inflation-indices
 * 
 * Runs daily at 10:00 AM Buenos Aires time to check for new INDEC reports.
 * Protected by CRON_SECRET to prevent unauthorized execution.
 * 
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/inflation-indices",
 *     "schedule": "0 13 * * *"  // 10:00 AM Buenos Aires (UTC-3)
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    runInflationIndexCron,
    forceInflationScrape,
    getInflationIndexStatus,
} from '@/lib/cron/inflation-index-crons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 2 minutes for Playwright

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

/**
 * POST - Run the cron job (called by Vercel Cron)
 */
export async function POST(request: NextRequest) {
    // Verify authorization
    if (!verifyCronSecret(request)) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    console.log('[Cron] Starting inflation index cron job...');

    const url = new URL(request.url);
    const force = url.searchParams.get('force') === 'true';

    try {
        const result = force
            ? await forceInflationScrape()
            : await runInflationIndexCron();

        console.log(`[Cron] Inflation cron complete in ${result.durationMs}ms`);

        return NextResponse.json({
            ...result,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('[Cron] Inflation cron failed:', error);

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

/**
 * GET - Get current status (for monitoring/admin)
 * In development, also allows triggering the cron
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // In development, allow running via GET for easy testing
    if (process.env.NODE_ENV === 'development') {
        if (action === 'run') {
            return POST(request);
        }
        if (action === 'force') {
            const result = await forceInflationScrape();
            return NextResponse.json({
                ...result,
                timestamp: new Date().toISOString(),
            });
        }
    }

    // Return current status
    try {
        const status = await getInflationIndexStatus();

        return NextResponse.json({
            success: true,
            status,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
