/**
 * Idempotency Store
 * =================
 *
 * Database-backed idempotency key management for preventing duplicate
 * processing of requests and jobs.
 */

import { prisma } from '../prisma';
import { log } from '../logging/logger';

// =============================================================================
// TYPES
// =============================================================================

export type IdempotencyStatus = 'processing' | 'completed' | 'failed';

export interface IdempotencyEntry {
  key: string;
  status: IdempotencyStatus;
  result?: any;
  statusCode?: number;
  error?: string;
  organizationId?: string;
  userId?: string;
  operationType?: string;
  requestPath?: string;
  requestMethod?: string;
  requestHash?: string;
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface IdempotencyCheckResult {
  exists: boolean;
  status?: IdempotencyStatus;
  result?: any;
  isComplete: boolean;
  canRetry: boolean;
}

export interface IdempotencySetOptions {
  organizationId?: string;
  userId?: string;
  operationType?: string;
  requestPath?: string;
  requestMethod?: string;
  requestHash?: string;
  ttlMs?: number;
}

// =============================================================================
// IDEMPOTENCY STORE
// =============================================================================

/**
 * IdempotencyStore - Manage idempotency keys for request deduplication
 *
 * @example
 * const store = new IdempotencyStore();
 *
 * // Check if request was already processed
 * const check = await store.check(idempotencyKey);
 * if (check.isComplete) {
 *   return check.result;
 * }
 *
 * // Mark as processing
 * await store.setPending(idempotencyKey, { operationType: 'payment_webhook' });
 *
 * // Process the request
 * try {
 *   const result = await processRequest();
 *   await store.setCompleted(idempotencyKey, result);
 *   return result;
 * } catch (error) {
 *   await store.setFailed(idempotencyKey, error.message);
 *   throw error;
 * }
 */
export class IdempotencyStore {
  private defaultTTLMs: number;

  constructor(options: { defaultTTLMs?: number } = {}) {
    // Default TTL of 24 hours
    this.defaultTTLMs = options.defaultTTLMs || 24 * 60 * 60 * 1000;
  }

  /**
   * Check if an idempotency key exists and get its status
   */
  async check(key: string): Promise<IdempotencyCheckResult> {
    try {
      const entry = await prisma.idempotencyKey.findUnique({
        where: { key },
      });

      if (!entry) {
        return {
          exists: false,
          isComplete: false,
          canRetry: true,
        };
      }

      // Check if expired
      if (entry.expiresAt < new Date()) {
        // Expired entry - can be retried
        await this.clear(key);
        return {
          exists: false,
          isComplete: false,
          canRetry: true,
        };
      }

      // Check if stuck in processing (older than 5 minutes)
      const processingTimeout = 5 * 60 * 1000; // 5 minutes
      const isStuck = entry.status === 'processing' &&
        new Date().getTime() - entry.createdAt.getTime() > processingTimeout;

      if (isStuck) {
        // Mark as failed so it can be retried
        await this.setFailed(key, 'Processing timeout');
        return {
          exists: true,
          status: 'failed',
          isComplete: false,
          canRetry: true,
        };
      }

      return {
        exists: true,
        status: entry.status as IdempotencyStatus,
        result: entry.result,
        isComplete: entry.status === 'completed',
        canRetry: entry.status === 'failed',
      };
    } catch (error) {
      log.error('Idempotency check failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // On error, allow processing (fail-open)
      return {
        exists: false,
        isComplete: false,
        canRetry: true,
      };
    }
  }

  /**
   * Atomically acquire an idempotency key (returns false if already acquired)
   */
  async acquire(key: string, options: IdempotencySetOptions = {}): Promise<boolean> {
    try {
      const ttlMs = options.ttlMs || this.defaultTTLMs;
      const expiresAt = new Date(Date.now() + ttlMs);

      await prisma.idempotencyKey.create({
        data: {
          key,
          status: 'processing',
          organizationId: options.organizationId,
          userId: options.userId,
          operationType: options.operationType,
          requestPath: options.requestPath,
          requestMethod: options.requestMethod,
          requestHash: options.requestHash,
          expiresAt,
        },
      });

      return true;
    } catch (error: any) {
      // If key already exists (unique constraint violation), return false
      if (error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Mark an idempotency key as pending (processing)
   */
  async setPending(key: string, options: IdempotencySetOptions = {}): Promise<void> {
    const ttlMs = options.ttlMs || this.defaultTTLMs;
    const expiresAt = new Date(Date.now() + ttlMs);

    await prisma.idempotencyKey.upsert({
      where: { key },
      update: {
        status: 'processing',
        result: null,
        completedAt: null,
      },
      create: {
        key,
        status: 'processing',
        organizationId: options.organizationId,
        userId: options.userId,
        operationType: options.operationType,
        requestPath: options.requestPath,
        requestMethod: options.requestMethod,
        requestHash: options.requestHash,
        expiresAt,
      },
    });

    log.debug('Idempotency key set to pending', { key });
  }

  /**
   * Mark an idempotency key as completed with result
   */
  async setCompleted(
    key: string,
    result: any,
    statusCode?: number,
    ttlMs?: number
  ): Promise<void> {
    const ttl = ttlMs || this.defaultTTLMs;
    const expiresAt = new Date(Date.now() + ttl);

    await prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: 'completed',
        result,
        statusCode,
        completedAt: new Date(),
        expiresAt,
      },
    });

    log.debug('Idempotency key completed', { key, statusCode });
  }

  /**
   * Mark an idempotency key as failed
   */
  async setFailed(key: string, error: string, ttlMs?: number): Promise<void> {
    const ttl = ttlMs || this.defaultTTLMs;
    const expiresAt = new Date(Date.now() + ttl);

    await prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: 'failed',
        result: { error },
        completedAt: new Date(),
        expiresAt,
      },
    });

    log.debug('Idempotency key failed', { key, error });
  }

  /**
   * Clear an idempotency key
   */
  async clear(key: string): Promise<void> {
    try {
      await prisma.idempotencyKey.delete({
        where: { key },
      });
      log.debug('Idempotency key cleared', { key });
    } catch (error: any) {
      // Ignore if key doesn't exist
      if (error.code !== 'P2025') {
        throw error;
      }
    }
  }

  /**
   * Get an idempotency entry by key
   */
  async get(key: string): Promise<IdempotencyEntry | null> {
    const entry = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (!entry) return null;

    return {
      key: entry.key,
      status: entry.status as IdempotencyStatus,
      result: entry.result,
      statusCode: entry.statusCode || undefined,
      organizationId: entry.organizationId || undefined,
      userId: entry.userId || undefined,
      operationType: entry.operationType || undefined,
      requestPath: entry.requestPath || undefined,
      requestMethod: entry.requestMethod || undefined,
      requestHash: entry.requestHash || undefined,
      expiresAt: entry.expiresAt,
      createdAt: entry.createdAt,
      completedAt: entry.completedAt || undefined,
    };
  }

  /**
   * Cleanup expired idempotency keys
   */
  async cleanupExpired(): Promise<number> {
    const result = await prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      log.info('Cleaned up expired idempotency keys', { count: result.count });
    }

    return result.count;
  }

  /**
   * Get stuck processing keys (for monitoring)
   */
  async getStuckKeys(processingTimeoutMs: number = 5 * 60 * 1000): Promise<IdempotencyEntry[]> {
    const cutoff = new Date(Date.now() - processingTimeoutMs);

    const entries = await prisma.idempotencyKey.findMany({
      where: {
        status: 'processing',
        createdAt: {
          lt: cutoff,
        },
      },
      take: 100,
    });

    return entries.map((entry) => ({
      key: entry.key,
      status: entry.status as IdempotencyStatus,
      result: entry.result,
      statusCode: entry.statusCode || undefined,
      organizationId: entry.organizationId || undefined,
      userId: entry.userId || undefined,
      operationType: entry.operationType || undefined,
      requestPath: entry.requestPath || undefined,
      requestMethod: entry.requestMethod || undefined,
      requestHash: entry.requestHash || undefined,
      expiresAt: entry.expiresAt,
      createdAt: entry.createdAt,
      completedAt: entry.completedAt || undefined,
    }));
  }

  /**
   * Get statistics for monitoring
   */
  async getStats(): Promise<{
    total: number;
    processing: number;
    completed: number;
    failed: number;
    expired: number;
    stuck: number;
  }> {
    const [total, processing, completed, failed, expired, stuck] = await Promise.all([
      prisma.idempotencyKey.count(),
      prisma.idempotencyKey.count({ where: { status: 'processing' } }),
      prisma.idempotencyKey.count({ where: { status: 'completed' } }),
      prisma.idempotencyKey.count({ where: { status: 'failed' } }),
      prisma.idempotencyKey.count({ where: { expiresAt: { lt: new Date() } } }),
      prisma.idempotencyKey.count({
        where: {
          status: 'processing',
          createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }),
    ]);

    return { total, processing, completed, failed, expired, stuck };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let idempotencyStore: IdempotencyStore | null = null;

/**
 * Get the global idempotency store instance
 */
export function getIdempotencyStore(): IdempotencyStore {
  if (!idempotencyStore) {
    idempotencyStore = new IdempotencyStore();
  }
  return idempotencyStore;
}

/**
 * Reset the idempotency store instance (for testing)
 */
export function resetIdempotencyStore(): void {
  idempotencyStore = null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate an idempotency key from request details
 */
export function generateIdempotencyKey(parts: {
  method?: string;
  path?: string;
  body?: any;
  orgId?: string;
  userId?: string;
}): string {
  const crypto = require('crypto');

  const hash = crypto.createHash('sha256');

  if (parts.method) hash.update(parts.method);
  if (parts.path) hash.update(parts.path);
  if (parts.body) hash.update(JSON.stringify(parts.body));
  if (parts.orgId) hash.update(parts.orgId);
  if (parts.userId) hash.update(parts.userId);

  return hash.digest('hex').slice(0, 32);
}

/**
 * Middleware for idempotent API endpoints
 */
export function idempotentMiddleware(options: {
  keyHeader?: string;
  keyGenerator?: (req: any) => string;
  ttlMs?: number;
} = {}) {
  const keyHeader = options.keyHeader || 'Idempotency-Key';
  const store = getIdempotencyStore();

  return async (req: any, res: any, next: () => void) => {
    // Get idempotency key from header or generate one
    let key = req.headers[keyHeader.toLowerCase()];

    if (!key && options.keyGenerator) {
      key = options.keyGenerator(req);
    }

    if (!key) {
      // No idempotency key - proceed normally
      return next();
    }

    // Check if request was already processed
    const check = await store.check(key);

    if (check.isComplete) {
      // Return cached result
      return res.status(check.result?.statusCode || 200).json(check.result?.body || check.result);
    }

    if (check.exists && !check.canRetry) {
      // Request is currently being processed
      return res.status(409).json({
        error: 'Request already in progress',
        idempotencyKey: key,
      });
    }

    // Acquire the key
    const acquired = await store.acquire(key, {
      organizationId: req.user?.organizationId,
      userId: req.user?.id,
      operationType: `${req.method} ${req.path}`,
      requestPath: req.path,
      requestMethod: req.method,
      ttlMs: options.ttlMs,
    });

    if (!acquired) {
      return res.status(409).json({
        error: 'Request already in progress',
        idempotencyKey: key,
      });
    }

    // Store key in request for later completion
    req.idempotencyKey = key;

    // Override res.json to capture response
    const originalJson = res.json.bind(res);
    res.json = async (body: any) => {
      if (req.idempotencyKey) {
        await store.setCompleted(req.idempotencyKey, {
          statusCode: res.statusCode,
          body,
        });
      }
      return originalJson(body);
    };

    next();
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default IdempotencyStore;
