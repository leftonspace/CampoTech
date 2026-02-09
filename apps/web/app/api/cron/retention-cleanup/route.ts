/**
 * Data Retention Cleanup Cron Endpoint
 * =====================================
 * 
 * POST /api/cron/retention-cleanup - Run retention cleanup tasks
 * GET /api/cron/retention-cleanup - Get last cleanup status
 * 
 * Schedule: Weekly on Sundays at 2:00 AM (05:00 UTC)
 * 
 * Tasks:
 * - Expire old data export requests (7-day retention)
 * - Cleanup old daily usage records (7-day retention)
 * - Process completed account deletions
 * - Archive old audit logs (5-year retention)
 * 
 * Implements retention policies per Phase 9 (Regulatory Compliance)
 */

import { NextRequest, NextResponse } from 'next/server';
import { runRetentionCleanup } from '@/lib/services/audit-encryption';

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for large cleanups

interface CleanupResult {
    success: boolean;
    expiredExports: number;
    completedDeletions: number;
    dailyUsageCleanup: number;
    durationMs: number;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Run Retention Cleanup
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();

    console.log('[RetentionCleanup] Starting data retention cleanup...');

    try {
        // Verify cron secret if configured
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
            const authHeader = request.headers.get('authorization');
            if (authHeader !== `Bearer ${cronSecret}`) {
                console.warn('[RetentionCleanup] Unauthorized request');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        // Run retention cleanup service
        const result = await runRetentionCleanup();

        const response: CleanupResult = {
            success: true,
            expiredExports: result.expiredExports,
            completedDeletions: result.completedDeletions,
            dailyUsageCleanup: result.dailyUsageCleanup,
            durationMs: Date.now() - startTime,
        };

        console.log(
            `[RetentionCleanup] Complete. Expired exports: ${result.expiredExports}, ` +
            `Completed deletions: ${result.completedDeletions}, ` +
            `Daily usage cleaned: ${result.dailyUsageCleanup}`
        );

        return NextResponse.json(response);
    } catch (error) {
        console.error('[RetentionCleanup] Fatal error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs: Date.now() - startTime,
                expiredExports: 0,
                completedDeletions: 0,
                dailyUsageCleanup: 0,
            } as CleanupResult,
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Last Cleanup Status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(): Promise<NextResponse> {
    try {
        // In production, this would query a cleanup log table
        // For now, return basic status
        return NextResponse.json({
            success: true,
            message: 'Retention cleanup status endpoint. Use POST to trigger cleanup.',
            schedule: 'Weekly on Sundays at 2:00 AM',
            tasks: [
                'Expire old data export requests (7-day retention)',
                'Cleanup daily usage records (7-day retention)',
                'Process completed account deletions',
                'Archive old audit logs (5-year retention)',
            ],
        });
    } catch (error) {
        console.error('[RetentionCleanup] Status check error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
