/**
 * Dead Letter Queue Management API
 * =================================
 *
 * Admin API for managing the dead letter queue.
 *
 * GET /api/admin/dlq - Get DLQ entries and stats
 * POST /api/admin/dlq - DLQ operations (retry, discard, bulk-retry)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { getSession } from '@/lib/auth';

// =============================================================================
// CONFIGURATION
// =============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DLQ_NAME = 'dead-letter-queue';

// Source queues for retry operations
const SOURCE_QUEUES: Record<string, string> = {
  'payment-webhook': 'payment-webhook',
  'job-notification': 'job-notification',
  'invoice-pdf': 'invoice-pdf',
  'notification-dispatch': 'notification-dispatch',
  'voice-processing': 'voice-processing',
  'reminder': 'reminder',
  'cae-queue': 'cae-queue',
  'whatsapp-queue': 'whatsapp-queue',
};

interface DLQEntry {
  id: string;
  sourceQueue: string;
  originalJobId: string;
  jobName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  failedReason: string;
  stacktrace?: string[];
  attemptsMade: number;
  movedAt: Date;
}

// =============================================================================
// HELPERS
// =============================================================================

async function requireAdmin(_request: NextRequest): Promise<{ user: { email?: string | null } } | NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleUpper = session.role?.toUpperCase();
    if (roleUpper !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return { user: session };
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

async function getQueue(queueName: string): Promise<{ queue: Queue; connection: Redis }> {
  const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(queueName, { connection });
  return { queue, connection };
}

function parseDLQJob(job: Job): DLQEntry | null {
  try {
    const payload = job.data.payload || job.data;
    return {
      id: job.id || 'unknown',
      sourceQueue: payload.sourceQueue || job.data.sourceQueue || 'unknown',
      originalJobId: payload.originalJob?.id || 'unknown',
      jobName: payload.originalJob?.name || job.name || 'unknown',
      data: payload.originalJob?.data || job.data,
      failedReason: payload.originalJob?.failedReason || 'Unknown error',
      stacktrace: payload.originalJob?.stacktrace,
      attemptsMade: payload.originalJob?.attemptsMade || 0,
      movedAt: new Date(payload.movedAt || job.timestamp),
    };
  } catch {
    return null;
  }
}

function classifyError(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('timeout')) return 'timeout';
  if (lower.includes('rate limit')) return 'rate_limit';
  if (lower.includes('connection') || lower.includes('network')) return 'network';
  if (lower.includes('auth') || lower.includes('unauthorized')) return 'auth';
  if (lower.includes('validation') || lower.includes('invalid')) return 'validation';
  if (lower.includes('not found') || lower.includes('404')) return 'not_found';
  if (lower.includes('500') || lower.includes('internal')) return 'server_error';

  return 'other';
}

// =============================================================================
// GET /api/admin/dlq
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const queue = searchParams.get('queue');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const { queue: dlq, connection } = await getQueue(DLQ_NAME);

  try {
    const jobs = await dlq.getJobs(['waiting', 'delayed', 'failed'], offset, offset + limit);

    let entries = jobs
      .map(parseDLQJob)
      .filter((e): e is DLQEntry => e !== null);

    // Filter by source queue if specified
    if (queue) {
      entries = entries.filter((e) => e.sourceQueue === queue);
    }

    // Calculate stats
    const allJobs = await dlq.getJobs(['waiting', 'delayed', 'failed']);
    const allEntries = allJobs.map(parseDLQJob).filter((e): e is DLQEntry => e !== null);

    const byQueue: Record<string, number> = {};
    const byErrorType: Record<string, number> = {};

    for (const entry of allEntries) {
      byQueue[entry.sourceQueue] = (byQueue[entry.sourceQueue] || 0) + 1;
      const errorType = classifyError(entry.failedReason);
      byErrorType[errorType] = (byErrorType[errorType] || 0) + 1;
    }

    return NextResponse.json({
      entries,
      total: allEntries.length,
      stats: {
        byQueue,
        byErrorType,
      },
      pagination: {
        offset,
        limit,
        hasMore: offset + entries.length < allEntries.length,
      },
    });
  } finally {
    await dlq.close();
    await connection.quit();
  }
}

// =============================================================================
// POST /api/admin/dlq
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { action, jobId, reason, queue: filterQueue, errorPattern } = body;

  const { queue: dlq, connection } = await getQueue(DLQ_NAME);

  try {
    switch (action) {
      case 'retry': {
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required' },
            { status: 400 }
          );
        }

        const job = await dlq.getJob(jobId);
        if (!job) {
          return NextResponse.json(
            { error: `DLQ entry '${jobId}' not found` },
            { status: 404 }
          );
        }

        const entry = parseDLQJob(job);
        if (!entry) {
          return NextResponse.json(
            { error: 'Could not parse DLQ entry' },
            { status: 400 }
          );
        }

        const sourceQueueName = SOURCE_QUEUES[entry.sourceQueue];
        if (!sourceQueueName) {
          return NextResponse.json(
            { error: `Unknown source queue: ${entry.sourceQueue}` },
            { status: 400 }
          );
        }

        const { queue: sourceQueue, connection: srcConn } = await getQueue(sourceQueueName);

        try {
          await sourceQueue.add(entry.jobName, entry.data, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 10000 },
          });

          await job.remove();

          return NextResponse.json({
            success: true,
            message: `Job '${jobId}' retried to queue '${sourceQueueName}'`,
          });
        } finally {
          await sourceQueue.close();
          await srcConn.quit();
        }
      }

      case 'discard': {
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required' },
            { status: 400 }
          );
        }

        const job = await dlq.getJob(jobId);
        if (!job) {
          return NextResponse.json(
            { error: `DLQ entry '${jobId}' not found` },
            { status: 404 }
          );
        }

        await job.updateData({
          ...job.data,
          discarded: true,
          discardReason: reason || 'Manually discarded',
          discardedAt: new Date().toISOString(),
          discardedBy: (auth as { user?: { email?: string } }).user?.email || 'admin',
        });

        await job.remove();

        return NextResponse.json({
          success: true,
          message: `Job '${jobId}' discarded`,
        });
      }

      case 'bulk-retry': {
        const jobs = await dlq.getJobs(['waiting', 'delayed', 'failed']);

        let entries = jobs
          .map((job) => ({ job, entry: parseDLQJob(job) }))
          .filter((e): e is { job: Job; entry: DLQEntry } => e.entry !== null);

        if (filterQueue) {
          entries = entries.filter((e) => e.entry.sourceQueue === filterQueue);
        }

        if (errorPattern) {
          entries = entries.filter((e) =>
            e.entry.failedReason.toLowerCase().includes(errorPattern.toLowerCase())
          );
        }

        let retried = 0;
        let failed = 0;

        for (const { job, entry } of entries) {
          try {
            const sourceQueueName = SOURCE_QUEUES[entry.sourceQueue];
            if (!sourceQueueName) {
              failed++;
              continue;
            }

            const { queue: sourceQueue, connection: srcConn } = await getQueue(sourceQueueName);

            try {
              await sourceQueue.add(entry.jobName, entry.data, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 10000 },
              });

              await job.remove();
              retried++;
            } finally {
              await sourceQueue.close();
              await srcConn.quit();
            }
          } catch {
            failed++;
          }
        }

        return NextResponse.json({
          success: true,
          message: `Bulk retry completed`,
          retried,
          failed,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } finally {
    await dlq.close();
    await connection.quit();
  }
}
