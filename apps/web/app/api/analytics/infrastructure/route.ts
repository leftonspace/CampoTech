/**
 * Analytics Infrastructure API
 * ============================
 *
 * Phase 10.1: Analytics Data Infrastructure
 * API endpoints for managing aggregation jobs and event queues.
 *
 * NOTE: This is a stub implementation. Full analytics requires monorepo package setup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// Stub aggregation jobs
const AGGREGATION_JOBS = [
  { id: 'daily_revenue', name: 'Daily Revenue', frequency: 'daily' },
  { id: 'weekly_kpis', name: 'Weekly KPIs', frequency: 'weekly' },
  { id: 'monthly_reports', name: 'Monthly Reports', frequency: 'monthly' },
];

/**
 * GET /api/analytics/infrastructure
 * Get infrastructure status including aggregation jobs, event queue stats, and KPI registry
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const component = searchParams.get('component');

    // Return specific component status
    if (component === 'aggregation-jobs') {
      return NextResponse.json({
        jobs: AGGREGATION_JOBS.map((job) => ({
          ...job,
          status: { lastRun: null, isRunning: false, nextRun: null },
        })),
      });
    }

    if (component === 'event-queue') {
      return NextResponse.json({
        eventQueue: { pending: 0, processed: 0, failed: 0 },
      });
    }

    if (component === 'kpis') {
      return NextResponse.json({
        kpis: ['revenue', 'jobs', 'customers', 'satisfaction'],
      });
    }

    // Return full infrastructure status
    return NextResponse.json({
      aggregationJobs: AGGREGATION_JOBS.map((job) => ({
        ...job,
        status: { lastRun: null, isRunning: false, nextRun: null },
      })),
      eventQueue: { pending: 0, processed: 0, failed: 0 },
      kpiRegistry: {
        total: 4,
        categories: ['revenue', 'operations', 'financial', 'customer'],
      },
    });
  } catch (error) {
    console.error('Infrastructure status error:', error);
    return NextResponse.json(
      { error: 'Failed to get infrastructure status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/infrastructure
 * Trigger infrastructure operations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can trigger infrastructure operations
    const roleUpper = session.role?.toUpperCase();
    if (roleUpper !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, jobId } = body;

    switch (action) {
      case 'run-aggregation-job': {
        if (!jobId) {
          return NextResponse.json(
            { error: 'Job ID required' },
            { status: 400 }
          );
        }
        const job = AGGREGATION_JOBS.find((j) => j.id === jobId);
        if (!job) {
          return NextResponse.json(
            { error: 'Job not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          message: `Aggregation job '${jobId}' triggered (stub implementation)`,
        });
      }

      case 'run-due-jobs': {
        return NextResponse.json({
          success: true,
          message: 'Due aggregation jobs processed (stub implementation)',
        });
      }

      case 'process-event-queue': {
        return NextResponse.json({
          success: true,
          message: 'Event queue processed (stub implementation)',
        });
      }

      case 'flush-events': {
        return NextResponse.json({
          success: true,
          message: 'Events flushed (stub implementation)',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Infrastructure operation error:', error);
    return NextResponse.json(
      { error: 'Failed to execute infrastructure operation' },
      { status: 500 }
    );
  }
}
