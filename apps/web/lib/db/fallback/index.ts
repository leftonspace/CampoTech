/**
 * Database Fallback Module (Phase 6B.2)
 * ======================================
 *
 * Provides resilient database operations with:
 * - Cached read fallbacks (6B.2.1)
 * - Write queue for overload (6B.2.2)
 *
 * Usage:
 * ```typescript
 * import {
 *   cachedRead,
 *   queueWrite,
 *   getCachedReadManager,
 *   getWriteQueueManager,
 * } from '@/lib/db/fallback';
 *
 * // Cached read with fallback
 * const user = await cachedRead('user', userId, () =>
 *   prisma.user.findUnique({ where: { id: userId } })
 * );
 *
 * // Queue a write when DB is under pressure
 * const result = await queueWrite('auditLog', 'create', {
 *   action: 'user.login',
 *   userId,
 * });
 * ```
 */

// Types
export type {
  // Cached read types
  CacheStrategy,
  CachedReadConfig,
  CachedData,
  CacheReadResult,
  CachedReadMetrics,
  // Write queue types
  WriteOperationType,
  WriteQueueStatus,
  QueuedWrite,
  WriteQueueConfig,
  WriteQueueStats,
  WriteQueueResult,
  // Health types
  DbHealthStatus,
  DbHealthState,
  DbCircuitState,
} from './types';

export {
  DEFAULT_CACHED_READ_CONFIG,
  DEFAULT_WRITE_QUEUE_CONFIG,
} from './types';

// Cached reads
export {
  CachedReadManager,
  getCachedReadManager,
  resetCachedReadManager,
  cachedRead,
  cachedReadWithInfo,
} from './cached-reads';

// Write queue
export {
  WriteQueueManager,
  getWriteQueueManager,
  resetWriteQueueManager,
  queueWrite,
  getWriteQueueStats,
  type WriteQueueEvent,
} from './write-queue';

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { getCachedReadManager } from './cached-reads';
import { getWriteQueueManager } from './write-queue';
import type { DbHealthStatus, WriteQueueStats, CachedReadMetrics } from './types';

/**
 * Get combined health status for database fallback systems
 */
export function getDbFallbackHealth(): {
  status: DbHealthStatus;
  cachedReads: {
    dbAvailable: boolean;
    cacheHitRate: number;
    staleFallbackRate: number;
  };
  writeQueue: WriteQueueStats;
  healthy: boolean;
} {
  const cachedReadManager = getCachedReadManager();
  const writeQueueManager = getWriteQueueManager();

  const cachedReadStatus = cachedReadManager.getStatus();
  const writeQueueStats = writeQueueManager.getStats();

  // Determine overall status
  let status: DbHealthStatus = 'healthy';
  if (!cachedReadStatus.dbAvailable || !writeQueueStats.dbAvailable) {
    status = 'unavailable';
  } else if (
    cachedReadStatus.staleFallbackRate > 0.1 ||
    writeQueueStats.pending > 100
  ) {
    status = 'degraded';
  }

  return {
    status,
    cachedReads: cachedReadStatus,
    writeQueue: writeQueueStats,
    healthy: status === 'healthy',
  };
}

/**
 * Get combined metrics
 */
export function getDbFallbackMetrics(): {
  cachedReads: CachedReadMetrics;
  writeQueue: WriteQueueStats;
} {
  return {
    cachedReads: getCachedReadManager().getMetrics(),
    writeQueue: getWriteQueueManager().getStats(),
  };
}

/**
 * Initialize both systems (call on app startup)
 */
export async function initDbFallback(): Promise<void> {
  // Initialize managers
  getCachedReadManager();
  const writeQueue = getWriteQueueManager();

  // Load persisted write queue
  await writeQueue.loadQueue();

  console.log('[DbFallback] Initialized cached reads and write queue');
}

/**
 * Graceful shutdown
 */
export function shutdownDbFallback(): void {
  const writeQueue = getWriteQueueManager();
  writeQueue.stopProcessing();
  console.log('[DbFallback] Shutdown complete');
}
