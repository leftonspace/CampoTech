/**
 * CampoTech Database Connections (Phase 5A.3 + 5A.4)
 * ===================================================
 *
 * Manages database connections with support for:
 * - Primary database (read + write operations)
 * - Read replica (analytics and heavy read queries)
 * - Connection pooling via PgBouncer (Supabase)
 * - Serverless-optimized connection management
 *
 * Connection URL Formats (Supabase):
 * - Direct: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
 * - Pooler: postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
 *
 * Always use the pooler URL in production for better connection management.
 *
 * Usage:
 * ```typescript
 * import { getDb, withDb } from '@/lib/db/connections';
 *
 * // Normal operations (uses primary)
 * const db = getDb();
 * await db.user.create({ ... });
 *
 * // Analytics (uses replica if available)
 * const db = getDb({ analytics: true });
 * await db.job.aggregate({ ... });
 *
 * // Scoped connection with automatic cleanup
 * const result = await withDb(async (db) => {
 *   return db.user.findMany();
 * });
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
// CONNECTION POOL CONFIGURATION (Phase 5A.4)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Connection pool settings optimized for serverless (Vercel + Supabase)
 *
 * PgBouncer Settings (configure in Supabase Dashboard):
 * - Pool Mode: transaction (recommended for serverless)
 * - Pool Size: 60 (Pro), 100 (Team), custom (Enterprise)
 *
 * Prisma Settings:
 * - connection_limit: Max connections per Prisma instance
 * - pool_timeout: How long to wait for a connection (seconds)
 * - connect_timeout: Connection establishment timeout (seconds)
 */
export const POOL_CONFIG = {
  // Supabase connection pool limits by plan
  poolLimits: {
    free: 20,
    pro: 60,
    team: 100,
    enterprise: 200,
  },

  // Prisma connection settings
  // These are appended to DATABASE_URL as query params
  prismaPoolSettings: {
    // Max connections per Prisma Client instance
    // Keep low for serverless to avoid exhausting pool
    connection_limit: parseInt(process.env.DB_CONNECTION_LIMIT || '5', 10),

    // Timeout waiting for a connection from pool (seconds)
    pool_timeout: parseInt(process.env.DB_POOL_TIMEOUT || '10', 10),

    // Timeout for establishing a new connection (seconds)
    connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10', 10),
  },

  // For serverless environments
  serverless: {
    // Disconnect after each request in serverless
    disconnectOnIdle: process.env.VERCEL === '1',

    // Idle timeout before connection is closed (ms)
    idleTimeout: 30000,
  },
} as const;

/**
 * Build connection URL with pool parameters
 */
function buildConnectionUrl(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) return undefined;

  const url = new URL(baseUrl);

  // Add Prisma pool settings as query parameters
  url.searchParams.set(
    'connection_limit',
    String(POOL_CONFIG.prismaPoolSettings.connection_limit)
  );
  url.searchParams.set(
    'pool_timeout',
    String(POOL_CONFIG.prismaPoolSettings.pool_timeout)
  );
  url.searchParams.set(
    'connect_timeout',
    String(POOL_CONFIG.prismaPoolSettings.connect_timeout)
  );

  return url.toString();
}

/**
 * Detect if we're using a pooled connection (PgBouncer)
 */
function isPooledConnection(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('pooler.supabase.com') || url.includes(':6543');
}

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
 * Create optimized Prisma client with pool settings
 */
function createPrismaClient(url: string | undefined, name: string): PrismaClient {
  const connectionUrl = buildConnectionUrl(url);
  const isPooled = isPooledConnection(url);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DB] Creating ${name} client:`, {
      pooled: isPooled,
      connectionLimit: POOL_CONFIG.prismaPoolSettings.connection_limit,
      poolTimeout: POOL_CONFIG.prismaPoolSettings.pool_timeout,
    });
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: connectionUrl,
      },
    },
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

/**
 * Primary database connection (read + write)
 * Uses connection pooling via PgBouncer when available
 *
 * For Supabase, use the pooler URL (port 6543) for better connection management:
 * postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
 */
export const db =
  globalForDb.prisma ?? createPrismaClient(process.env.DATABASE_URL, 'primary');

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
    if (process.env.NODE_ENV === 'development') {
      console.log('[DB] Read replica not configured - using primary for all queries');
    }
    return null;
  }

  console.log('[DB] Read replica configured - analytics queries will use replica');
  return createPrismaClient(replicaUrl, 'replica');
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION POOL UTILITIES (Phase 5A.4)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a function with scoped database access
 * Ensures proper connection management in serverless environments
 *
 * @example
 * const users = await withDb(async (db) => {
 *   return db.user.findMany();
 * });
 *
 * @example
 * // With analytics replica
 * const stats = await withDb(
 *   async (db) => db.job.aggregate({ _count: true }),
 *   { analytics: true }
 * );
 */
export async function withDb<T>(
  fn: (client: PrismaClient) => Promise<T>,
  options?: DbOptions
): Promise<T> {
  const client = getDb(options);

  try {
    return await fn(client);
  } finally {
    // In serverless, disconnect to release connection back to pool
    if (POOL_CONFIG.serverless.disconnectOnIdle) {
      // Don't await - let it happen in background
      client.$disconnect().catch((err) => {
        console.error('[DB] Error disconnecting:', err);
      });
    }
  }
}

/**
 * Execute a transaction with proper connection management
 *
 * @example
 * await withTransaction(async (tx) => {
 *   await tx.user.create({ data: { ... } });
 *   await tx.auditLog.create({ data: { ... } });
 * });
 */
export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
  }
): Promise<T> {
  // Prisma interactive transactions: pass options as second argument
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.$transaction as any)(fn, {
    maxWait: options?.maxWait ?? 5000,
    timeout: options?.timeout ?? 10000,
    isolationLevel: options?.isolationLevel,
  });
}

/**
 * Check pool health and get detailed status
 */
export async function getPoolHealth(): Promise<{
  healthy: boolean;
  primary: {
    connected: boolean;
    latency?: number;
    pooled: boolean;
    settings: typeof POOL_CONFIG.prismaPoolSettings;
  };
  replica: {
    available: boolean;
    connected?: boolean;
    latency?: number;
    pooled?: boolean;
  };
  warnings: string[];
}> {
  const warnings: string[] = [];
  const primaryUrl = process.env.DATABASE_URL;
  const replicaUrl = process.env.DATABASE_REPLICA_URL;

  const result = {
    healthy: false,
    primary: {
      connected: false,
      latency: undefined as number | undefined,
      pooled: isPooledConnection(primaryUrl),
      settings: POOL_CONFIG.prismaPoolSettings,
    },
    replica: {
      available: !!replicaUrl,
      connected: undefined as boolean | undefined,
      latency: undefined as number | undefined,
      pooled: isPooledConnection(replicaUrl),
    },
    warnings,
  };

  // Check primary
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    result.primary.connected = true;
    result.primary.latency = Date.now() - start;
  } catch (error) {
    result.primary.connected = false;
    warnings.push(`Primary connection failed: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // Check replica if available
  if (dbReplica) {
    try {
      const start = Date.now();
      await dbReplica.$queryRaw`SELECT 1`;
      result.replica.connected = true;
      result.replica.latency = Date.now() - start;
    } catch (error) {
      result.replica.connected = false;
      warnings.push(`Replica connection failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  // Check for non-pooled connections in production
  if (process.env.NODE_ENV === 'production' && !result.primary.pooled) {
    warnings.push('Primary database is not using pooled connection. Use pooler URL for better performance.');
  }

  result.healthy = result.primary.connected && warnings.length === 0;

  return result;
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
