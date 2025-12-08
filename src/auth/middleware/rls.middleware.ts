/**
 * Row Level Security (RLS) Middleware
 * ====================================
 *
 * Sets PostgreSQL session variables for RLS policies.
 * Ensures multi-tenant data isolation at the database level.
 */

import { Request, Response, NextFunction } from 'express';
import { Pool, PoolClient } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RLSContext {
  orgId: string;
  userId: string;
  role: string;
}

// Global pool reference (set via initialize)
let dbPool: Pool | null = null;

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize RLS middleware with database pool
 */
export function initializeRLS(pool: Pool): void {
  dbPool = pool;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RLS context middleware
 * Sets session variables before each request for RLS policy enforcement
 */
export function rlsContext() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if no auth context (public routes)
    if (!req.auth) {
      return next();
    }

    // Skip if no database pool configured
    if (!dbPool) {
      console.warn('RLS middleware: Database pool not initialized');
      return next();
    }

    // Attach RLS-aware query function to request
    req.rlsQuery = createRLSQuery(req.auth.orgId, req.auth.userId, req.auth.role);

    next();
  };
}

/**
 * Create RLS-aware query function
 * Automatically sets session variables before executing queries
 */
function createRLSQuery(orgId: string, userId: string, role: string) {
  return async <T = any>(
    sql: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> => {
    if (!dbPool) {
      throw new Error('Database pool not initialized');
    }

    const client = await dbPool.connect();

    try {
      // Set RLS context variables
      await setRLSContext(client, { orgId, userId, role });

      // Execute the actual query
      const result = await client.query(sql, params);

      return {
        rows: result.rows as T[],
        rowCount: result.rowCount ?? 0,
      };
    } finally {
      // Reset context and release connection
      await resetRLSContext(client);
      client.release();
    }
  };
}

/**
 * Set RLS context session variables
 */
async function setRLSContext(client: PoolClient, context: RLSContext): Promise<void> {
  // Use SET LOCAL so variables are transaction-scoped
  // These are used by RLS policies: current_setting('app.current_org_id')
  // Variable names must match the migrations (001-014)
  await client.query(`
    SELECT
      set_config('app.current_org_id', $1, true),
      set_config('app.current_user_id', $2, true),
      set_config('app.current_user_role', $3, true)
  `, [context.orgId, context.userId, context.role]);
}

/**
 * Reset RLS context (clear session variables)
 */
async function resetRLSContext(client: PoolClient): Promise<void> {
  await client.query(`
    SELECT
      set_config('app.current_org_id', '', true),
      set_config('app.current_user_id', '', true),
      set_config('app.current_user_role', '', true)
  `);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute multiple queries in a transaction with RLS context
 */
export async function withRLSTransaction<T>(
  context: RLSContext,
  callback: (query: (sql: string, params?: any[]) => Promise<any>) => Promise<T>
): Promise<T> {
  if (!dbPool) {
    throw new Error('Database pool not initialized');
  }

  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');
    await setRLSContext(client, context);

    const query = (sql: string, params?: any[]) => client.query(sql, params);
    const result = await callback(query);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await resetRLSContext(client);
    client.release();
  }
}

/**
 * Get a client with RLS context already set
 * Caller is responsible for releasing the client
 */
export async function getRLSClient(context: RLSContext): Promise<{
  client: PoolClient;
  release: () => Promise<void>;
}> {
  if (!dbPool) {
    throw new Error('Database pool not initialized');
  }

  const client = await dbPool.connect();
  await setRLSContext(client, context);

  return {
    client,
    release: async () => {
      await resetRLSContext(client);
      client.release();
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE AUGMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      rlsQuery?: <T = any>(
        sql: string,
        params?: any[]
      ) => Promise<{ rows: T[]; rowCount: number }>;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { RLSContext };
