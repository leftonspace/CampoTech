/**
 * Buffer Cleanup Worker
 * =====================
 *
 * Phase 9.8: Message Aggregation System
 * Cleans up old conversation contexts, buffer stats, and orphaned data.
 * Runs periodically (e.g., daily) to maintain database hygiene.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { Redis } from 'ioredis';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// How long to keep conversation contexts (24 hours by default)
const CONTEXT_TTL_HOURS = 24;

// How long to keep aggregation events for analytics (30 days)
const AGGREGATION_EVENTS_TTL_DAYS = 30;

// How long to keep buffer stats (90 days)
const BUFFER_STATS_TTL_DAYS = 90;

// How long to keep auto-response logs (7 days)
const AUTO_RESPONSE_LOGS_TTL_DAYS = 7;

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean up expired conversation contexts
 */
export async function cleanupExpiredContexts(): Promise<number> {
  try {
    const result = await db.conversationContext.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    log.info('Cleaned up expired conversation contexts', { deleted: result.count });
    return result.count;
  } catch (error) {
    log.error('Error cleaning up conversation contexts', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return 0;
  }
}

/**
 * Clean up old aggregation events
 */
export async function cleanupOldAggregationEvents(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - AGGREGATION_EVENTS_TTL_DAYS);

    const result = await db.messageAggregationEvent.deleteMany({
      where: {
        processedAt: { lt: cutoffDate },
      },
    });

    log.info('Cleaned up old aggregation events', { deleted: result.count });
    return result.count;
  } catch (error) {
    // Table may not exist
    log.debug('Could not cleanup aggregation events', { error });
    return 0;
  }
}

/**
 * Clean up old buffer statistics
 */
export async function cleanupOldBufferStats(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BUFFER_STATS_TTL_DAYS);

    const result = await db.messageBufferStats.deleteMany({
      where: {
        date: { lt: cutoffDate },
      },
    });

    log.info('Cleaned up old buffer stats', { deleted: result.count });
    return result.count;
  } catch (error) {
    log.error('Error cleaning up buffer stats', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return 0;
  }
}

/**
 * Clean up old auto-response logs
 */
export async function cleanupOldAutoResponseLogs(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - AUTO_RESPONSE_LOGS_TTL_DAYS);

    const result = await db.autoResponseLog.deleteMany({
      where: {
        sentAt: { lt: cutoffDate },
      },
    });

    log.info('Cleaned up old auto-response logs', { deleted: result.count });
    return result.count;
  } catch (error) {
    log.error('Error cleaning up auto-response logs', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return 0;
  }
}

/**
 * Clean up orphaned Redis buffers
 * (buffers that somehow weren't processed and are very old)
 */
export async function cleanupOrphanedRedisBuffers(): Promise<number> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redis = new Redis(redisUrl);

    const bufferKeys = await redis.keys('msgbuf:*');
    const timeoutKeys = await redis.keys('msgbuf_timeout:*');
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour max for any buffer

    let deleted = 0;

    for (const key of [...bufferKeys, ...timeoutKeys]) {
      try {
        const data = await redis.get(key);
        if (!data) continue;

        const parsed = JSON.parse(data);
        const age = now - (parsed.createdAt || parsed.lastMessageAt || 0);

        if (age > maxAge) {
          await redis.del(key);
          deleted++;
        }
      } catch {
        // If we can't parse it, delete it
        await redis.del(key);
        deleted++;
      }
    }

    await redis.quit();

    if (deleted > 0) {
      log.info('Cleaned up orphaned Redis buffers', { deleted });
    }

    return deleted;
  } catch (error) {
    log.warn('Could not cleanup Redis buffers (Redis may not be available)', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CLEANUP JOB
// ═══════════════════════════════════════════════════════════════════════════════

export interface CleanupResult {
  contextsDeleted: number;
  aggregationEventsDeleted: number;
  bufferStatsDeleted: number;
  autoResponseLogsDeleted: number;
  redisBuffersDeleted: number;
  totalDeleted: number;
  duration: number;
}

/**
 * Run all cleanup tasks
 */
export async function runFullCleanup(): Promise<CleanupResult> {
  const startTime = Date.now();
  log.info('Starting buffer cleanup job');

  const [
    contextsDeleted,
    aggregationEventsDeleted,
    bufferStatsDeleted,
    autoResponseLogsDeleted,
    redisBuffersDeleted,
  ] = await Promise.all([
    cleanupExpiredContexts(),
    cleanupOldAggregationEvents(),
    cleanupOldBufferStats(),
    cleanupOldAutoResponseLogs(),
    cleanupOrphanedRedisBuffers(),
  ]);

  const totalDeleted =
    contextsDeleted +
    aggregationEventsDeleted +
    bufferStatsDeleted +
    autoResponseLogsDeleted +
    redisBuffersDeleted;

  const duration = Date.now() - startTime;

  const result: CleanupResult = {
    contextsDeleted,
    aggregationEventsDeleted,
    bufferStatsDeleted,
    autoResponseLogsDeleted,
    redisBuffersDeleted,
    totalDeleted,
    duration,
  };

  log.info('Buffer cleanup job completed', result);

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED WORKER
// ═══════════════════════════════════════════════════════════════════════════════

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the cleanup worker with scheduled runs
 */
export function startCleanupWorker(intervalHours: number = 24): void {
  if (cleanupInterval) {
    log.warn('Cleanup worker already running');
    return;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  log.info('Starting buffer cleanup worker', { intervalHours });

  // Run immediately on start
  runFullCleanup().catch((error) => {
    log.error('Initial cleanup failed', { error });
  });

  // Schedule periodic runs
  cleanupInterval = setInterval(() => {
    runFullCleanup().catch((error) => {
      log.error('Scheduled cleanup failed', { error });
    });
  }, intervalMs);
}

/**
 * Stop the cleanup worker
 */
export function stopCleanupWorker(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    log.info('Buffer cleanup worker stopped');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

// Auto-start if running as main process
if (require.main === module) {
  // Run once and exit, or run as scheduled worker
  const scheduled = process.argv.includes('--scheduled');

  if (scheduled) {
    startCleanupWorker(24); // Every 24 hours

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      stopCleanupWorker();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      stopCleanupWorker();
      process.exit(0);
    });
  } else {
    // Run once and exit
    runFullCleanup()
      .then((result) => {
        console.log('Cleanup completed:', result);
        process.exit(0);
      })
      .catch((error) => {
        console.error('Cleanup failed:', error);
        process.exit(1);
      });
  }
}
