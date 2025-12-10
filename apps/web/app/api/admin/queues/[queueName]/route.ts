/**
 * Queue Operations API
 * ====================
 *
 * Admin API for managing individual queues.
 *
 * GET /api/admin/queues/:queueName - Get queue details
 * POST /api/admin/queues/:queueName - Queue operations (pause, resume, clean)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

// =============================================================================
// CONFIGURATION
// =============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// =============================================================================
// HELPERS
// =============================================================================

async function requireAdmin(request: NextRequest): Promise<{ user: any } | NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role || (session.user as any).organizationRole;
    if (!['owner', 'admin'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return { user: session.user };
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

async function getQueue(queueName: string): Promise<{ queue: Queue; connection: Redis }> {
  const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(queueName, { connection });
  return { queue, connection };
}

// =============================================================================
// GET /api/admin/queues/:queueName
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { queueName: string } }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { queueName } = params;
  const { queue, connection } = await getQueue(queueName);

  try {
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    // Get recent jobs
    const [waitingJobs, activeJobs, failedJobs] = await Promise.all([
      queue.getWaiting(0, 9),
      queue.getActive(0, 9),
      queue.getFailed(0, 9),
    ]);

    return NextResponse.json({
      name: queueName,
      stats: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused,
      },
      recentJobs: {
        waiting: waitingJobs.map((j) => ({
          id: j.id,
          name: j.name,
          timestamp: j.timestamp,
          data: j.data,
        })),
        active: activeJobs.map((j) => ({
          id: j.id,
          name: j.name,
          timestamp: j.timestamp,
          processedOn: j.processedOn,
        })),
        failed: failedJobs.map((j) => ({
          id: j.id,
          name: j.name,
          timestamp: j.timestamp,
          failedReason: j.failedReason,
          attemptsMade: j.attemptsMade,
        })),
      },
    });
  } finally {
    await queue.close();
    await connection.quit();
  }
}

// =============================================================================
// POST /api/admin/queues/:queueName
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { queueName: string } }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { queueName } = params;
  const body = await request.json();
  const { action, jobId, status, age } = body;

  const { queue, connection } = await getQueue(queueName);

  try {
    switch (action) {
      case 'pause':
        await queue.pause();
        return NextResponse.json({
          success: true,
          message: `Queue '${queueName}' paused`,
        });

      case 'resume':
        await queue.resume();
        return NextResponse.json({
          success: true,
          message: `Queue '${queueName}' resumed`,
        });

      case 'drain':
        await queue.drain();
        return NextResponse.json({
          success: true,
          message: `Queue '${queueName}' drained`,
        });

      case 'clean':
        const cleanStatus = status || 'completed';
        const cleanAge = age || 24 * 60 * 60 * 1000; // 24 hours default
        const cleaned = await queue.clean(cleanAge, 1000, cleanStatus);
        return NextResponse.json({
          success: true,
          message: `Cleaned ${cleaned.length} jobs from '${queueName}'`,
          count: cleaned.length,
        });

      case 'retry':
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required for retry' },
            { status: 400 }
          );
        }
        const job = await queue.getJob(jobId);
        if (!job) {
          return NextResponse.json(
            { error: `Job '${jobId}' not found` },
            { status: 404 }
          );
        }
        await job.retry();
        return NextResponse.json({
          success: true,
          message: `Job '${jobId}' queued for retry`,
        });

      case 'remove':
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required for remove' },
            { status: 400 }
          );
        }
        const jobToRemove = await queue.getJob(jobId);
        if (!jobToRemove) {
          return NextResponse.json(
            { error: `Job '${jobId}' not found` },
            { status: 404 }
          );
        }
        await jobToRemove.remove();
        return NextResponse.json({
          success: true,
          message: `Job '${jobId}' removed`,
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } finally {
    await queue.close();
    await connection.quit();
  }
}
