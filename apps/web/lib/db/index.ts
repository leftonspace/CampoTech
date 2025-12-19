/**
 * CampoTech Database Module (Phase 5A.3 + 5A.4)
 * ==============================================
 *
 * Central database management with:
 * - Read replica support for analytics
 * - Connection pool optimization for serverless
 * - Scoped connection utilities
 *
 * Basic usage:
 * ```typescript
 * import { db, getDb, withDb } from '@/lib/db';
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
