/**
 * CampoTech Database Module (Phase 5A.3)
 * ======================================
 *
 * Central database management with read replica support.
 *
 * Basic usage:
 * ```typescript
 * import { db, getDb } from '@/lib/db';
 *
 * // Normal operations
 * await db.user.findMany();
 *
 * // Analytics queries (uses replica if available)
 * const analyticsDb = getDb({ analytics: true });
 * await analyticsDb.job.aggregate({ ... });
 * ```
 */

export {
  // Database clients
  db,
  dbReplica,
  prisma, // Backward compatibility alias

  // Connection helper
  getDb,

  // Utility functions
  isReplicaAvailable,
  getConnectionStatus,
  disconnectAll,
  withReplica,
  withReadAfterWrite,

  // Types
  type DbOptions,
  type TransactionClient,
} from './connections';
