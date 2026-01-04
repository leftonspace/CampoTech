/**
 * Queue Management API
 * ====================
 *
 * Admin API for managing BullMQ queues.
 *
 * GET /api/admin/queues - Get all queue statistics
 * POST /api/admin/queues/:queueName/pause - Pause a queue
 * POST /api/admin/queues/:queueName/resume - Resume a queue
 */

import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { getSession, type TokenPayload } from '@/lib/auth';

// =============================================================================
// CONFIGURATION
// =============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const ALL_QUEUES = [
  'payment-webhook',
  'job-notification',
  'invoice-pdf',
  'notification-dispatch',
  'voice-processing',
  'reminder',
  'cae-queue',
  'whatsapp-queue',
  'payment-queue',
  'notification-queue',
  'scheduled-queue',
  'dead-letter-queue',
];

// =============================================================================
// HELPERS
// =============================================================================

async function requireAdmin(): Promise<{ user: TokenPayload } | NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return { user: session };
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

async function getRedisConnection(): Promise<Redis> {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}

async function getQueueStats(queueName: string) {
  const connection = await getRedisConnection();
  const queue = new Queue(queueName, { connection });

  try {
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    // Get oldest job age
    let oldestJobAge: number | undefined;
    const waitingJobs = await queue.getWaiting(0, 0);
    if (waitingJobs.length > 0) {
      oldestJobAge = Math.round((Date.now() - waitingJobs[0].timestamp) / 1000);
    }

    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
      oldestJobAge,
    };
  } finally {
    await queue.close();
    await connection.quit();
  }
}

// =============================================================================
// GET /api/admin/queues
// =============================================================================

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const stats = await Promise.all(ALL_QUEUES.map(getQueueStats));

    const totals = {
      waiting: stats.reduce((sum, s) => sum + s.waiting, 0),
      active: stats.reduce((sum, s) => sum + s.active, 0),
      completed: stats.reduce((sum, s) => sum + s.completed, 0),
      failed: stats.reduce((sum, s) => sum + s.failed, 0),
      delayed: stats.reduce((sum, s) => sum + s.delayed, 0),
    };

    return NextResponse.json({
      queues: stats,
      totals,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return NextResponse.json(
      { error: 'Failed to get queue statistics' },
      { status: 500 }
    );
  }
}
