/**
 * Verification Cron Endpoint
 * ==========================
 *
 * POST /api/cron/verification - Run all verification cron jobs
 * POST /api/cron/verification?job=document-expiring - Run specific job
 * POST /api/cron/verification?job=document-expired - Run specific job
 * POST /api/cron/verification?job=employee-compliance - Run specific job
 * POST /api/cron/verification?job=afip-revalidation - Run AFIP revalidation (weekly)
 * GET /api/cron/verification - Get verification cron status
 *
 * Schedule (Buenos Aires time):
 * - Document expiring: 0 11 * * * (8:00 AM Buenos Aires = 11:00 UTC)
 * - Document expired: 0 9 * * * (6:00 AM Buenos Aires = 09:00 UTC)
 * - Employee compliance: 0 11 * * * (8:00 AM Buenos Aires = 11:00 UTC)
 * - AFIP revalidation: 0 6 * * 0 (3:00 AM Buenos Aires on Sunday = 06:00 UTC)
 *
 * Triggered by Vercel Cron or external scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkDocumentExpiring,
  checkDocumentExpired,
  checkEmployeeCompliance,
  revalidateAFIP,
  runAllVerificationCrons,
  getVerificationCronStatus,
  CronJobResult,
} from '@/lib/cron/verification-crons';

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max

type JobName = 'document-expiring' | 'document-expired' | 'employee-compliance' | 'afip-revalidation' | 'all';

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Run Verification Cron Jobs (called by cron scheduler)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[VerificationCron] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const searchParams = request.nextUrl.searchParams;
    const job = (searchParams.get('job') || 'all') as JobName;

    console.log(`[VerificationCron] Starting job: ${job}...`);

    let results: Record<string, CronJobResult | undefined> = {};

    switch (job) {
      case 'document-expiring':
        results.documentExpiring = await checkDocumentExpiring();
        break;

      case 'document-expired':
        results.documentExpired = await checkDocumentExpired();
        break;

      case 'employee-compliance':
        results.employeeCompliance = await checkEmployeeCompliance();
        break;

      case 'afip-revalidation':
        results.afipRevalidation = await revalidateAFIP();
        break;

      case 'all':
      default:
        const allResults = await runAllVerificationCrons();
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

    console.log('[VerificationCron] Job complete:', {
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
    console.error('[VerificationCron] Fatal error:', error);
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
// GET - Get Verification Cron Status (for monitoring)
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

    const status = await getVerificationCronStatus();

    const needsAttention =
      status.expiredDocuments > 0 ||
      status.documentReminders.expiring1Day > 0 ||
      status.employeeIssues > 5;

    return NextResponse.json({
      healthy: true,
      status: {
        documentReminders: status.documentReminders,
        expiredDocuments: status.expiredDocuments,
        employeeIssues: status.employeeIssues,
        lastRunAt: {
          documentExpiring: status.lastRunAt.documentExpiring?.toISOString() || null,
          documentExpired: status.lastRunAt.documentExpired?.toISOString() || null,
          afipRevalidation: status.lastRunAt.afipRevalidation?.toISOString() || null,
          employeeCompliance: status.lastRunAt.employeeCompliance?.toISOString() || null,
        },
      },
      needsAttention,
      alerts: needsAttention
        ? [
            ...(status.expiredDocuments > 0
              ? [`${status.expiredDocuments} expired documents pending processing`]
              : []),
            ...(status.documentReminders.expiring1Day > 0
              ? [`${status.documentReminders.expiring1Day} documents expiring tomorrow`]
              : []),
            ...(status.employeeIssues > 5
              ? [`${status.employeeIssues} employee compliance issues`]
              : []),
          ]
        : [],
    });
  } catch (error) {
    console.error('[VerificationCron] Status check error:', error);
    return NextResponse.json(
      {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
