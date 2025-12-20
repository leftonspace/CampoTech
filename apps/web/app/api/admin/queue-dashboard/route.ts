/**
 * Queue Dashboard API (Phase 5B.2.2)
 * ===================================
 *
 * API endpoints for queue monitoring and management dashboard.
 *
 * GET /api/admin/queue-dashboard - Get comprehensive queue metrics
 * POST /api/admin/queue-dashboard - Perform queue operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getQueueMetrics,
  analyzeLittleLaw,
  getHistoricalMetrics,
  resetMetrics,
  type QueueMetrics,
  type LittleLawAnalysis,
  type HistoricalMetrics,
} from '@/lib/queue/metrics';
import {
  getQueueStats,
  getQueueLength,
} from '@/lib/queue/dispatcher';
import {
  getWorkerStats,
  isWorkersRunning,
  getDeadLetterJobs,
  retryDeadLetterQueue,
  clearDeadLetterQueue,
} from '@/lib/queue/workers';
import {
  type QueueTier,
  QUEUE_TIERS,
  QUEUE_CONFIG,
  JOB_TYPES,
} from '@/lib/queue/config';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH HELPER
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthResult {
  user: {
    id: string;
    role: string;
    organizationId?: string;
  };
}

async function requireAdmin(): Promise<AuthResult | NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return {
      user: {
        id: session.userId,
        role: session.role,
        organizationId: session.organizationId,
      },
    };
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/queue-dashboard
// ═══════════════════════════════════════════════════════════════════════════════

interface DashboardResponse {
  metrics: QueueMetrics;
  littleLaw: Record<QueueTier, LittleLawAnalysis>;
  workers: {
    running: boolean;
    stats: ReturnType<typeof getWorkerStats>;
  };
  configuration: {
    tiers: typeof QUEUE_TIERS;
    jobTypes: typeof JOB_TYPES;
    config: typeof QUEUE_CONFIG;
  };
  historical?: Record<QueueTier, HistoricalMetrics>;
  dlq: {
    realtime: number;
    background: number;
    batch: number;
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const includeHistorical = searchParams.get('historical') === 'true';
  const period = (searchParams.get('period') || 'hour') as 'hour' | 'day' | 'week';
  const tier = searchParams.get('tier') as QueueTier | null;

  try {
    // Fetch core metrics
    const [metrics, queueStats] = await Promise.all([
      getQueueMetrics(),
      getQueueStats(),
    ]);

    // Fetch Little's Law analysis for all tiers
    const tiers: QueueTier[] = tier ? [tier] : ['realtime', 'background', 'batch'];
    const littleLawResults = await Promise.all(
      tiers.map((t) => analyzeLittleLaw(t))
    );
    const littleLaw = littleLawResults.reduce(
      (acc, result) => {
        acc[result.tier] = result;
        return acc;
      },
      {} as Record<QueueTier, LittleLawAnalysis>
    );

    // Get worker stats
    const workerStats = getWorkerStats();
    const workersRunning = isWorkersRunning();

    // Get DLQ counts
    const [dlqRealtime, dlqBackground, dlqBatch] = await Promise.all([
      getQueueLength('realtime'),
      getQueueLength('background'),
      getQueueLength('batch'),
    ]);

    // Build response
    const response: DashboardResponse = {
      metrics,
      littleLaw,
      workers: {
        running: workersRunning,
        stats: workerStats,
      },
      configuration: {
        tiers: QUEUE_TIERS,
        jobTypes: JOB_TYPES,
        config: QUEUE_CONFIG,
      },
      dlq: {
        realtime: dlqRealtime,
        background: dlqBackground,
        batch: dlqBatch,
      },
    };

    // Include historical data if requested
    if (includeHistorical) {
      const historicalResults = await Promise.all(
        tiers.map((t) => getHistoricalMetrics(t, period))
      );
      response.historical = historicalResults.reduce(
        (acc, result) => {
          acc[result.tier] = result;
          return acc;
        },
        {} as Record<QueueTier, HistoricalMetrics>
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Queue dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue dashboard data' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/queue-dashboard
// Queue operations (retry DLQ, clear DLQ, reset metrics)
// ═══════════════════════════════════════════════════════════════════════════════

interface OperationRequest {
  action: 'retry_dlq' | 'clear_dlq' | 'reset_metrics' | 'get_dlq_jobs';
  tier: QueueTier;
  limit?: number;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as OperationRequest;
    const { action, tier, limit = 100 } = body;

    if (!tier || !['realtime', 'background', 'batch'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier specified' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'retry_dlq': {
        const retriedCount = await retryDeadLetterQueue(tier);
        return NextResponse.json({
          success: true,
          message: `Retried ${retriedCount} jobs from ${tier} DLQ`,
          count: retriedCount,
        });
      }

      case 'clear_dlq': {
        const clearedCount = await clearDeadLetterQueue(tier);
        return NextResponse.json({
          success: true,
          message: `Cleared ${clearedCount} jobs from ${tier} DLQ`,
          count: clearedCount,
        });
      }

      case 'reset_metrics': {
        await resetMetrics(tier);
        return NextResponse.json({
          success: true,
          message: `Reset metrics for ${tier}`,
        });
      }

      case 'get_dlq_jobs': {
        const jobs = await getDeadLetterJobs(tier, limit);
        return NextResponse.json({
          success: true,
          jobs: jobs.map((job) => ({
            id: job.id,
            type: job.type,
            status: job.status,
            error: job.error,
            attempts: job.attempts,
            createdAt: job.createdAt,
            completedAt: job.completedAt,
          })),
          count: jobs.length,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Queue operation error:', error);
    return NextResponse.json(
      { error: 'Failed to perform queue operation' },
      { status: 500 }
    );
  }
}
