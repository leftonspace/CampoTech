/**
 * Idempotency Service
 * ===================
 *
 * Prevents duplicate processing of requests using idempotency keys.
 * Critical for payment processing and AFIP invoicing.
 */

import { Redis } from 'ioredis';
import * as crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface IdempotencyRecord {
  /** Idempotency key */
  key: string;
  /** Status of the operation */
  status: 'pending' | 'completed' | 'failed';
  /** Result of completed operation (JSON) */
  result?: string;
  /** Error message if failed */
  error?: string;
  /** When the record was created */
  createdAt: string;
  /** When the record was last updated */
  updatedAt: string;
  /** Request fingerprint for validation */
  fingerprint?: string;
}

export interface IdempotencyConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Key prefix for namespacing */
  keyPrefix?: string;
  /** Default TTL for records (seconds) */
  defaultTTL?: number;
  /** Lock timeout for pending operations (seconds) */
  lockTimeout?: number;
}

export interface IdempotencyResult<T> {
  /** Whether the operation was a duplicate */
  isDuplicate: boolean;
  /** Cached result if duplicate */
  cachedResult?: T;
  /** Whether the operation is still pending */
  isPending: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_TTL = 24 * 60 * 60; // 24 hours
const DEFAULT_LOCK_TIMEOUT = 30; // 30 seconds
const KEY_PREFIX = 'idem:';

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class IdempotencyService {
  private redis: Redis;
  private config: Required<IdempotencyConfig>;

  constructor(config: IdempotencyConfig) {
    this.redis = new Redis(config.redisUrl);
    this.config = {
      redisUrl: config.redisUrl,
      keyPrefix: config.keyPrefix || KEY_PREFIX,
      defaultTTL: config.defaultTTL || DEFAULT_TTL,
      lockTimeout: config.lockTimeout || DEFAULT_LOCK_TIMEOUT,
    };
  }

  /**
   * Check idempotency and acquire lock if needed
   */
  async check<T = any>(
    key: string,
    requestFingerprint?: string
  ): Promise<IdempotencyResult<T>> {
    const fullKey = this.getFullKey(key);

    // Try to get existing record
    const existing = await this.getRecord(fullKey);

    if (existing) {
      // Validate fingerprint if provided
      if (requestFingerprint && existing.fingerprint !== requestFingerprint) {
        throw new IdempotencyConflictError(
          'Idempotency key reused with different request parameters'
        );
      }

      // Check status
      if (existing.status === 'completed') {
        return {
          isDuplicate: true,
          isPending: false,
          cachedResult: existing.result ? JSON.parse(existing.result) : undefined,
        };
      }

      if (existing.status === 'pending') {
        // Check if lock has expired
        const createdAt = new Date(existing.createdAt).getTime();
        const lockExpiry = createdAt + this.config.lockTimeout * 1000;

        if (Date.now() < lockExpiry) {
          return {
            isDuplicate: true,
            isPending: true,
          };
        }

        // Lock expired, can retry
        await this.setRecord(fullKey, {
          ...existing,
          status: 'pending',
          updatedAt: new Date().toISOString(),
        });

        return {
          isDuplicate: false,
          isPending: false,
        };
      }

      if (existing.status === 'failed') {
        // Allow retry of failed operations
        await this.setRecord(fullKey, {
          ...existing,
          status: 'pending',
          error: undefined,
          updatedAt: new Date().toISOString(),
        });

        return {
          isDuplicate: false,
          isPending: false,
        };
      }
    }

    // Create new pending record
    const record: IdempotencyRecord = {
      key,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fingerprint: requestFingerprint,
    };

    const acquired = await this.tryAcquire(fullKey, record);

    if (!acquired) {
      // Race condition - another request got the lock
      return {
        isDuplicate: true,
        isPending: true,
      };
    }

    return {
      isDuplicate: false,
      isPending: false,
    };
  }

  /**
   * Mark operation as completed
   */
  async complete<T>(key: string, result: T, ttl?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const existing = await this.getRecord(fullKey);

    if (!existing) {
      throw new Error(`Idempotency record not found: ${key}`);
    }

    const record: IdempotencyRecord = {
      ...existing,
      status: 'completed',
      result: JSON.stringify(result),
      updatedAt: new Date().toISOString(),
    };

    await this.setRecord(fullKey, record, ttl || this.config.defaultTTL);
  }

  /**
   * Mark operation as failed
   */
  async fail(key: string, error: string | Error, ttl?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const existing = await this.getRecord(fullKey);

    if (!existing) {
      throw new Error(`Idempotency record not found: ${key}`);
    }

    const errorMessage = error instanceof Error ? error.message : error;

    const record: IdempotencyRecord = {
      ...existing,
      status: 'failed',
      error: errorMessage,
      updatedAt: new Date().toISOString(),
    };

    // Failed operations get shorter TTL to allow retry
    const failTTL = Math.min(ttl || this.config.defaultTTL, 60 * 60); // Max 1 hour

    await this.setRecord(fullKey, record, failTTL);
  }

  /**
   * Delete idempotency record
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    await this.redis.del(fullKey);
  }

  /**
   * Execute operation with automatic idempotency handling
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    options?: {
      fingerprint?: string;
      ttl?: number;
    }
  ): Promise<T> {
    const result = await this.check<T>(key, options?.fingerprint);

    if (result.isDuplicate) {
      if (result.isPending) {
        throw new IdempotencyPendingError('Operation is still pending');
      }
      return result.cachedResult!;
    }

    try {
      const operationResult = await operation();
      await this.complete(key, operationResult, options?.ttl);
      return operationResult;
    } catch (error) {
      await this.fail(key, error as Error, options?.ttl);
      throw error;
    }
  }

  /**
   * Generate idempotency key from request data
   */
  static generateKey(
    orgId: string,
    operation: string,
    ...params: (string | number)[]
  ): string {
    const data = [orgId, operation, ...params].join(':');
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Generate fingerprint from request body
   */
  static generateFingerprint(data: any): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private getFullKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private async getRecord(fullKey: string): Promise<IdempotencyRecord | null> {
    const data = await this.redis.get(fullKey);
    return data ? JSON.parse(data) : null;
  }

  private async setRecord(
    fullKey: string,
    record: IdempotencyRecord,
    ttl?: number
  ): Promise<void> {
    const data = JSON.stringify(record);

    if (ttl) {
      await this.redis.setex(fullKey, ttl, data);
    } else {
      await this.redis.set(fullKey, data);
    }
  }

  private async tryAcquire(
    fullKey: string,
    record: IdempotencyRecord
  ): Promise<boolean> {
    const data = JSON.stringify(record);
    // Use SET NX for atomic acquisition
    const result = await this.redis.set(
      fullKey,
      data,
      'EX',
      this.config.lockTimeout,
      'NX'
    );
    return result === 'OK';
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.redis.quit();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASSES
// ═══════════════════════════════════════════════════════════════════════════════

export class IdempotencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyError';
  }
}

export class IdempotencyConflictError extends IdempotencyError {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export class IdempotencyPendingError extends IdempotencyError {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyPendingError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let idempotencyService: IdempotencyService | null = null;

/**
 * Initialize the global idempotency service
 */
export function initializeIdempotencyService(config: IdempotencyConfig): void {
  idempotencyService = new IdempotencyService(config);
}

/**
 * Get the global idempotency service
 */
export function getIdempotencyService(): IdempotencyService {
  if (!idempotencyService) {
    throw new Error('Idempotency service not initialized');
  }
  return idempotencyService;
}
