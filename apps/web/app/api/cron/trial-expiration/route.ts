/**
 * Trial Expiration Cron Endpoint
 * ==============================
 *
 * POST /api/cron/trial-expiration - Process expired trials
 * GET /api/cron/trial-expiration - Get trial expiration status
 *
 * Runs daily at 1:00 AM Buenos Aires time (4:00 AM UTC)
 * Schedule: 0 4 * * *
 *
 * Triggered by Vercel Cron or external scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  processExpiredTrials,
  getTrialExpirationStatus,
  sendExpirationWarnings,
} from '@/lib/cron/trial-expiration';

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute max

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Process Expired Trials (called by cron scheduler)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[TrialExpirationCron] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[TrialExpirationCron] Starting trial expiration job...');

    // Process expired trials
    const expirationResult = await processExpiredTrials();

    // Also send warning notifications
    const warningsResult = await sendExpirationWarnings();

    const duration = Date.now() - startTime;

    console.log('[TrialExpirationCron] Job complete:', {
      duration: `${duration}ms`,
      processed: expirationResult.processedCount,
      expired: expirationResult.expiredCount,
      warnings: warningsResult.sent3Day + warningsResult.sent7Day,
      errors: expirationResult.errorCount + warningsResult.errors,
    });

    return NextResponse.json({
      success: expirationResult.success && warningsResult.errors === 0,
      duration,
      expiration: {
        processedCount: expirationResult.processedCount,
        expiredCount: expirationResult.expiredCount,
        errorCount: expirationResult.errorCount,
        errors: expirationResult.errors.length > 0 ? expirationResult.errors : undefined,
      },
      warnings: {
        sent3Day: warningsResult.sent3Day,
        sent7Day: warningsResult.sent7Day,
        errors: warningsResult.errors,
      },
    });
  } catch (error) {
    console.error('[TrialExpirationCron] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Trial Expiration Status (for monitoring)
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify auth for status check
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const status = await getTrialExpirationStatus();

    return NextResponse.json({
      healthy: true,
      status: {
        pendingExpirations: status.pendingExpirations,
        expiringIn24h: status.expiringIn24h,
        expiringIn7d: status.expiringIn7d,
        lastRunAt: status.lastRunAt?.toISOString() || null,
      },
      needsAttention: status.pendingExpirations > 0,
    });
  } catch (error) {
    console.error('[TrialExpirationCron] Status check error:', error);
    return NextResponse.json(
      {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
