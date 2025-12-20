/**
 * Subscription Cron Endpoint
 * ==========================
 *
 * POST /api/cron/subscription - Run all subscription cron jobs
 * POST /api/cron/subscription?job=trial-expiring - Run specific job
 * POST /api/cron/subscription?job=trial-expired - Run specific job
 * POST /api/cron/subscription?job=payment-reminders - Run specific job
 * GET /api/cron/subscription - Get subscription cron status
 *
 * Schedule (Buenos Aires time):
 * - Trial reminders: 0 12 * * * (9:00 AM Buenos Aires = 12:00 UTC)
 * - Trial expiration: 0 9 * * * (6:00 AM Buenos Aires = 09:00 UTC)
 * - Payment reminders: 0 12 * * * (9:00 AM Buenos Aires = 12:00 UTC)
 *
 * Triggered by Vercel Cron or external scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkTrialExpiring,
  checkTrialExpired,
  sendPaymentReminders,
  runAllSubscriptionCrons,
  getSubscriptionCronStatus,
  CronJobResult,
} from '@/lib/cron/subscription-crons';

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max

type JobName = 'trial-expiring' | 'trial-expired' | 'payment-reminders' | 'all';

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Run Subscription Cron Jobs (called by cron scheduler)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[SubscriptionCron] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const searchParams = request.nextUrl.searchParams;
    const job = (searchParams.get('job') || 'all') as JobName;

    console.log(`[SubscriptionCron] Starting job: ${job}...`);

    let results: Record<string, CronJobResult | undefined> = {};

    switch (job) {
      case 'trial-expiring':
        results.trialExpiring = await checkTrialExpiring();
        break;

      case 'trial-expired':
        results.trialExpired = await checkTrialExpired();
        break;

      case 'payment-reminders':
        results.paymentReminders = await sendPaymentReminders();
        break;

      case 'all':
      default:
        const allResults = await runAllSubscriptionCrons();
        results = allResults;
        break;
    }

    const duration = Date.now() - startTime;

    // Calculate totals
    const totals = Object.values(results).reduce(
      (acc, result) => {
        if (result) {
          acc.processed += result.processed;
          acc.succeeded += result.succeeded;
          acc.failed += result.failed;
        }
        return acc;
      },
      { processed: 0, succeeded: 0, failed: 0 }
    );

    const success = Object.values(results).every((r) => r?.success !== false);

    console.log('[SubscriptionCron] Job complete:', {
      job,
      duration: `${duration}ms`,
      ...totals,
    });

    return NextResponse.json({
      success,
      job,
      duration,
      totals,
      results: Object.fromEntries(
        Object.entries(results).map(([key, value]) => [
          key,
          value
            ? {
                success: value.success,
                processed: value.processed,
                succeeded: value.succeeded,
                failed: value.failed,
                errors: value.errors.length > 0 ? value.errors : undefined,
                durationMs: value.durationMs,
              }
            : undefined,
        ])
      ),
    });
  } catch (error) {
    console.error('[SubscriptionCron] Fatal error:', error);
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
// GET - Get Subscription Cron Status (for monitoring)
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

    const status = await getSubscriptionCronStatus();

    const needsAttention =
      status.expiredTrials > 0 ||
      status.trialReminders.expiring1Day > 0;

    return NextResponse.json({
      healthy: true,
      status: {
        trialReminders: status.trialReminders,
        expiredTrials: status.expiredTrials,
        upcomingRenewals: status.upcomingRenewals,
        lastRunAt: {
          trialReminders: status.lastRunAt.trialReminders?.toISOString() || null,
          trialExpiration: status.lastRunAt.trialExpiration?.toISOString() || null,
          paymentReminders: status.lastRunAt.paymentReminders?.toISOString() || null,
        },
      },
      needsAttention,
      alerts: needsAttention
        ? [
            ...(status.expiredTrials > 0
              ? [`${status.expiredTrials} expired trials pending processing`]
              : []),
            ...(status.trialReminders.expiring1Day > 0
              ? [`${status.trialReminders.expiring1Day} trials expiring tomorrow`]
              : []),
          ]
        : [],
    });
  } catch (error) {
    console.error('[SubscriptionCron] Status check error:', error);
    return NextResponse.json(
      {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
