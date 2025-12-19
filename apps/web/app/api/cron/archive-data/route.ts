/**
 * CampoTech Data Archival Cron Endpoint (Phase 5A.2.2)
 * =====================================================
 *
 * Runs daily at 3:00 AM to archive old data.
 * Triggered by Vercel Cron or external scheduler.
 *
 * Schedule: 0 6 * * * (3:00 AM UTC-3 = 6:00 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  archiveOldData,
  getArchivalStatus,
  validateArchivalSafe,
} from '@/lib/jobs/data-archiver';

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

/**
 * POST /api/cron/archive-data
 * Runs the archival job (called by cron scheduler)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[ArchiveCron] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Check if archival is safe to proceed
    const validation = await validateArchivalSafe();
    if (!validation.safe) {
      console.error('[ArchiveCron] Pre-flight check failed:', validation.warnings);
      return NextResponse.json(
        {
          error: 'Pre-flight check failed',
          warnings: validation.warnings,
        },
        { status: 503 }
      );
    }

    // Run the archival job
    console.log('[ArchiveCron] Starting archival job...');
    const result = await archiveOldData();

    // Calculate summary
    const totalArchived = result.results.reduce((sum, r) => sum + r.recordsArchived, 0);
    const totalDeleted = result.results.reduce((sum, r) => sum + r.recordsDeleted, 0);
    const failedTables = result.results.filter((r) => !r.success).map((r) => r.table);

    // Log completion
    console.log('[ArchiveCron] Job complete:', {
      duration: `${Date.now() - startTime}ms`,
      success: result.overallSuccess,
      archived: totalArchived,
      deleted: totalDeleted,
      failed: failedTables,
    });

    // Return results
    return NextResponse.json({
      success: result.overallSuccess,
      startTime: result.startTime,
      endTime: result.endTime,
      duration: result.totalDuration,
      summary: {
        totalArchived,
        totalDeleted,
        failedTables,
      },
      results: result.results.map((r) => ({
        table: r.table,
        success: r.success,
        archived: r.recordsArchived,
        deleted: r.recordsDeleted,
        duration: r.duration,
        errors: r.errors.length > 0 ? r.errors : undefined,
      })),
    });
  } catch (error) {
    console.error('[ArchiveCron] Fatal error:', error);
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

/**
 * GET /api/cron/archive-data
 * Returns archival status and pending work (for monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify auth for status check
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const status = await getArchivalStatus();
    const validation = await validateArchivalSafe();

    return NextResponse.json({
      healthy: validation.safe,
      warnings: validation.warnings,
      ...status,
    });
  } catch (error) {
    console.error('[ArchiveCron] Status check error:', error);
    return NextResponse.json(
      {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
