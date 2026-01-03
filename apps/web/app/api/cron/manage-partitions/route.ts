/**
 * Partition Manager Cron Endpoint (Phase 5A.1.5)
 * ===============================================
 *
 * Cron job endpoint for automatic partition management.
 *
 * Schedule: Weekly on Sunday at 2:00 AM (Argentina Time)
 * Vercel Cron: 0 5 * * 0 (5 AM UTC = 2 AM ART)
 *
 * This endpoint:
 * 1. Creates partitions for future time periods
 * 2. Checks partition health
 * 3. Alerts if partitions are missing
 * 4. Returns detailed status for monitoring
 *
 * Security:
 * - Protected by CRON_SECRET environment variable
 * - Can also be triggered manually by admin users
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  managePartitions,
  checkPartitionHealth,
  // type PartitionManagerResult,
} from '@/lib/jobs/partition-manager';

// Verify cron secret for security
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // If no cron secret configured, check for admin auth
  if (!cronSecret) {
    console.warn('[PartitionCron] CRON_SECRET not configured');
    return false;
  }

  // Check bearer token
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check Vercel cron header
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  if (vercelCronHeader === cronSecret) {
    return true;
  }

  return false;
}

/**
 * GET /api/cron/manage-partitions
 *
 * Health check endpoint - returns partition status without making changes
 */
export async function GET(request: NextRequest) {
  // Allow health checks without auth for monitoring
  const { searchParams } = new URL(request.url);
  const isHealthCheck = searchParams.get('health') === 'true';

  if (isHealthCheck) {
    try {
      const health = await checkPartitionHealth();

      return NextResponse.json({
        status: health.healthy ? 'healthy' : 'degraded',
        warnings: health.warnings,
        partitionCounts: Object.fromEntries(
          Object.entries(health.stats).map(([table, stats]) => [
            table,
            stats.length,
          ])
        ),
        timestamp: new Date().toISOString(),
      });
    } catch (_error) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Failed to check partition health',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  }

  // For full status, require auth
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const health = await checkPartitionHealth();

    return NextResponse.json({
      status: health.healthy ? 'healthy' : 'warning',
      warnings: health.warnings,
      stats: health.stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[PartitionCron] Health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/manage-partitions
 *
 * Execute partition management - creates missing partitions
 * Protected by CRON_SECRET
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[PartitionCron] Starting partition management job...');
  const startTime = Date.now();

  try {
    // Run partition management
    const result = await managePartitions();

    // Log results
    const duration = Date.now() - startTime;
    console.log(
      `[PartitionCron] Completed in ${duration}ms:`,
      JSON.stringify({
        success: result.success,
        tablesProcessed: result.tablesProcessed,
        partitionsCreated: result.partitionsCreated,
        partitionsMissing: result.partitionsMissing,
        errorCount: result.errors.length,
      })
    );

    // Check health after management
    const health = await checkPartitionHealth();

    // Determine response status
    const httpStatus = result.success ? 200 : 207; // 207 = Multi-Status (partial success)

    return NextResponse.json(
      {
        success: result.success,
        duration: `${duration}ms`,
        summary: {
          tablesProcessed: result.tablesProcessed,
          partitionsCreated: result.partitionsCreated,
          partitionsMissing: result.partitionsMissing,
          errorCount: result.errors.length,
        },
        details: result.details,
        errors: result.errors,
        health: {
          healthy: health.healthy,
          warnings: health.warnings,
        },
        timestamp: new Date().toISOString(),
      },
      { status: httpStatus }
    );
  } catch (error) {
    console.error('[PartitionCron] Job failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Vercel cron configuration
export const config = {
  runtime: 'nodejs',
};

// Export for Vercel cron (vercel.json or crons in vercel.json)
// Add to vercel.json:
// {
//   "crons": [
//     {
//       "path": "/api/cron/manage-partitions",
//       "schedule": "0 5 * * 0"
//     }
//   ]
// }
