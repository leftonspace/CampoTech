/**
 * Budget Check Cron Job (Phase 8A.2.1)
 * =====================================
 *
 * Scheduled endpoint to check budget thresholds and send alerts.
 * Should be called hourly via Vercel Cron or external scheduler.
 *
 * Vercel cron configuration (vercel.json):
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-budgets",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkBudgetAlerts, sendDailyCostReport } from '@/lib/costs/alerts';

/**
 * GET /api/cron/check-budgets
 * Run budget checks and send alerts
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hour = new Date().getHours();

    // Check budget thresholds
    await checkBudgetAlerts();

    // Send daily report at 11 PM (23:00)
    if (hour === 23) {
      await sendDailyCostReport();
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      actions: {
        budgetChecked: true,
        dailyReportSent: hour === 23,
      },
    });
  } catch (error) {
    console.error('[Cron] Budget check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export { GET as POST };
