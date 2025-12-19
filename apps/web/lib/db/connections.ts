/**
 * CampoTech Database Connections (Phase 5A.3)
 * ============================================
 *
 * Manages database connections with support for:
 * - Primary database (read + write operations)
 * - Read replica (analytics and heavy read queries)
 * - Connection pooling via PgBouncer
 *
 * Usage:
 * ```typescript
 * import { getDb } from '@/lib/db/connections';
 *
 * // Normal operations (uses primary)
 * const db = getDb();
 * await db.user.create({ ... });
 *
 * // Analytics (uses replica if available)
 * const db = getDb({ analytics: true });
 * await db.job.aggregate({ ... });
 * ```
 */

import { PrismaClient } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DbOptions {
  /**
   * Use read replica for analytics queries.
   * Falls back to primary if replica not configured.
   */
  analytics?: boolean;

  /**
   * Force use of primary database even for read operations.
   * Use when you need strong consistency after a write.
   */
  forcePrimary?: boolean;
}

// Transaction client type for use in $transaction callbacks
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL SINGLETON PATTERN
// ═══════════════════════════════════════════════════════════════════════════════

const globalForDb = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaReplica: PrismaClient | undefined;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMARY DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Primary database connection (read + write)
 * Uses connection pooling via PgBouncer when available
 */
export const db =
  globalForDb.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.prisma = db;
}

// ═══════════════════════════════════════════════════════════════════════════════
// READ REPLICA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Read replica connection (read-only, for analytics)
 * Only initialized if DATABASE_REPLICA_URL is configured
 *
 * Benefits:
 * - Offloads heavy analytics queries from primary
 * - Prevents reports from slowing down the app
 * - Can have different connection pool settings
 */
function createReplicaClient(): PrismaClient | null {
  const replicaUrl = process.env.DATABASE_REPLICA_URL;

  if (!replicaUrl) {
    console.log('[DB] Read replica not configured - using primary for all queries');
    return null;
  }

  console.log('[DB] Read replica configured - analytics queries will use replica');

  return new PrismaClient({
    datasources: {
      db: {
        url: replicaUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });
}

export const dbReplica = globalForDb.prismaReplica ?? createReplicaClient();

if (process.env.NODE_ENV !== 'production' && dbReplica) {
  globalForDb.prismaReplica = dbReplica;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the appropriate database connection based on options
 *
 * @param options - Connection options
 * @returns PrismaClient instance
 *
 * @example
 * // Normal CRUD operations
 * const db = getDb();
 *
 * // Analytics/reporting queries
 * const db = getDb({ analytics: true });
 *
 * // Force primary after write for consistency
 * const db = getDb({ forcePrimary: true });
 */
export function getDb(options?: DbOptions): PrismaClient {
  // Force primary if requested
  if (options?.forcePrimary) {
    return db;
  }

  // Use replica for analytics if available
  if (options?.analytics && dbReplica) {
    return dbReplica;
  }

  // Default to primary
  return db;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if read replica is available
 */
export function isReplicaAvailable(): boolean {
  return dbReplica !== null;
}

/**
 * Get connection status for monitoring
 */
export async function getConnectionStatus(): Promise<{
  primary: { connected: boolean; latency?: number };
  replica: { available: boolean; connected?: boolean; latency?: number };
}> {
  const result = {
    primary: { connected: false, latency: undefined as number | undefined },
    replica: {
      available: isReplicaAvailable(),
      connected: undefined as boolean | undefined,
      latency: undefined as number | undefined,
    },
  };

  // Check primary
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    result.primary.connected = true;
    result.primary.latency = Date.now() - start;
  } catch {
    result.primary.connected = false;
  }

  // Check replica if available
  if (dbReplica) {
    try {
      const start = Date.now();
      await dbReplica.$queryRaw`SELECT 1`;
      result.replica.connected = true;
      result.replica.latency = Date.now() - start;
    } catch {
      result.replica.connected = false;
    }
  }

  return result;
}

/**
 * Gracefully disconnect all database connections
 * Call this in cleanup/shutdown handlers
 */
export async function disconnectAll(): Promise<void> {
  const disconnections: Promise<void>[] = [db.$disconnect()];

  if (dbReplica) {
    disconnections.push(dbReplica.$disconnect());
  }

  await Promise.all(disconnections);
  console.log('[DB] All connections closed');
}

/**
 * Execute a function with the replica, falling back to primary if unavailable
 */
export async function withReplica<T>(
  fn: (client: PrismaClient) => Promise<T>
): Promise<T> {
  const client = dbReplica || db;
  return fn(client);
}

/**
 * Execute a read query on replica, write on primary (read-after-write consistency)
 * Useful for operations that need to write then immediately read back
 */
export async function withReadAfterWrite<T>(
  writeFn: (client: PrismaClient) => Promise<unknown>,
  readFn: (client: PrismaClient) => Promise<T>
): Promise<T> {
  // Write to primary
  await writeFn(db);

  // Read from primary (not replica) for consistency
  // Replication lag could cause stale reads
  return readFn(db);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// Re-export the primary client as 'prisma' for backward compatibility
export { db as prisma };
