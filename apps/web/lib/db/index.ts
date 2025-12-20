/**
 * CampoTech Database Module (Phase 5A.3 + 5A.4 + 6B.2)
 * =====================================================
 *
 * Central database management with:
 * - Read replica support for analytics
 * - Connection pool optimization for serverless
 * - Scoped connection utilities
 * - Cached read fallbacks (6B.2.1)
 * - Write queue for overload (6B.2.2)
 *
 * Basic usage:
 * ```typescript
 * import { db, getDb, withDb, cachedRead, queueWrite } from '@/lib/db';
 *
 * // Normal operations
 * await db.user.findMany();
 *
 * // Analytics queries (uses replica if available)
 * const analyticsDb = getDb({ analytics: true });
 * await analyticsDb.job.aggregate({ ... });
 *
 * // Scoped connection with automatic cleanup
 * const result = await withDb(async (db) => {
 *   return db.user.findMany();
 * });
 *
 * // Cached read with fallback (6B.2.1)
 * const user = await cachedRead('user', userId, () =>
 *   db.user.findUnique({ where: { id: userId } })
 * );
 *
 * // Queue write when DB is under pressure (6B.2.2)
 * await queueWrite('auditLog', 'create', { action: 'login', userId });
 * ```
 */

export {
  // Database clients
  db,
  dbReplica,
  prisma, // Backward compatibility alias

  // Connection helpers
  getDb,
  withDb,
  withTransaction,

  // Utility functions
  isReplicaAvailable,
  getConnectionStatus,
  getPoolHealth,
  disconnectAll,
  withReplica,
  withReadAfterWrite,

  // Configuration
  POOL_CONFIG,

  // Types
  type DbOptions,
  type TransactionClient,
} from './connections';

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE FALLBACK (Phase 6B.2)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Cached reads (6B.2.1)
  CachedReadManager,
  getCachedReadManager,
  resetCachedReadManager,
  cachedRead,
  cachedReadWithInfo,

  // Write queue (6B.2.2)
  WriteQueueManager,
  getWriteQueueManager,
  resetWriteQueueManager,
  queueWrite,
  getWriteQueueStats,

  // Combined health/metrics
  getDbFallbackHealth,
  getDbFallbackMetrics,
  initDbFallback,
  shutdownDbFallback,

  // Types
  type CacheStrategy,
  type CachedReadConfig,
  type CachedData,
  type CacheReadResult,
  type CachedReadMetrics,
  type WriteOperationType,
  type WriteQueueStatus,
  type QueuedWrite,
  type WriteQueueConfig,
  type WriteQueueStats,
  type WriteQueueResult,
  type DbHealthStatus,
  type DbHealthState,
  type DbCircuitState,
  type WriteQueueEvent,
} from './fallback';
