/**
 * Analytics Infrastructure API
 * ============================
 *
 * Phase 10.1: Analytics Data Infrastructure
 * API endpoints for managing aggregation jobs and event queues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  AGGREGATION_JOBS,
  runAggregationJob,
  getAggregationJobStatus,
  runDueAggregationJobs,
  getEventQueueStats,
  processEventQueue,
  flushEvents,
  KPI_REGISTRY,
  getAllKPIs,
} from '@/src/analytics';

/**
 * GET /api/analytics/infrastructure
 * Get infrastructure status including aggregation jobs, event queue stats, and KPI registry
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const { searchParams } = new URL(request.url);
    const component = searchParams.get('component');

    // Return specific component status
    if (component === 'aggregation-jobs') {
      const jobStatuses = await Promise.all(
        AGGREGATION_JOBS.map(async (job) => ({
          ...job,
          status: await getAggregationJobStatus(organizationId, job.id),
        }))
      );
      return NextResponse.json({ jobs: jobStatuses });
    }

    if (component === 'event-queue') {
      const stats = await getEventQueueStats(organizationId);
      return NextResponse.json({ eventQueue: stats });
    }

    if (component === 'kpis') {
      const kpis = getAllKPIs();
      return NextResponse.json({ kpis });
    }

    // Return full infrastructure status
    const [jobStatuses, eventStats] = await Promise.all([
      Promise.all(
        AGGREGATION_JOBS.map(async (job) => ({
          ...job,
          status: await getAggregationJobStatus(organizationId, job.id),
        }))
      ),
      getEventQueueStats(organizationId),
    ]);

    return NextResponse.json({
      aggregationJobs: jobStatuses,
      eventQueue: eventStats,
      kpiRegistry: {
        total: Object.keys(KPI_REGISTRY).length,
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins and owners can trigger infrastructure operations
    if (!['ADMIN', 'OWNER'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = session.user.organizationId;
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
        await runAggregationJob(organizationId, job);
        return NextResponse.json({
          success: true,
          message: `Aggregation job '${jobId}' completed`,
        });
      }

      case 'run-due-jobs': {
        await runDueAggregationJobs(organizationId);
        return NextResponse.json({
          success: true,
          message: 'Due aggregation jobs processed',
        });
      }

      case 'process-event-queue': {
        await processEventQueue(organizationId);
        return NextResponse.json({
          success: true,
          message: 'Event queue processed',
        });
      }

      case 'flush-events': {
        await flushEvents(organizationId);
        return NextResponse.json({
          success: true,
          message: 'Events flushed',
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
