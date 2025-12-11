/**
 * Distributed Lock Service
 * ========================
 *
 * Redis-based distributed locking using the Redlock algorithm.
 * Prevents race conditions in multi-instance deployments for:
 * - AFIP invoice number reservation
 * - Payment webhook idempotency
 * - Job assignment conflicts
 *
 * Implementation based on Redis single-instance locking pattern
 * with proper fencing tokens and automatic expiration.
 */

import { Redis } from 'ioredis';
import * as crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Lock {
  /** Resource being locked */
  resource: string;
  /** Unique lock identifier (fencing token) */
  value: string;
  /** When the lock expires (Unix timestamp ms) */
  expiry: number;
  /** Number of extensions performed */
  extensions: number;
}

export interface DistributedLockConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Key prefix for lock keys */
  keyPrefix?: string;
  /** Default lock TTL in milliseconds */
  defaultTTL?: number;
  /** Retry count for lock acquisition */
  retryCount?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Jitter factor for retry delay (0-1) */
  retryJitter?: number;
  /** Clock drift factor */
  driftFactor?: number;
  /** Callback on lock acquisition */
  onAcquire?: (resource: string, ttlMs: number) => void;
  /** Callback on lock release */
  onRelease?: (resource: string) => void;
  /** Callback on lock extension */
  onExtend?: (resource: string, ttlMs: number) => void;
  /** Callback on lock acquisition failure */
  onFail?: (resource: string, error: Error) => void;
}

export interface AcquireOptions {
  /** Lock TTL in milliseconds */
  ttlMs?: number;
  /** Number of retry attempts */
  retryCount?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

export interface LockResult {
  /** Whether lock was acquired */
  acquired: boolean;
  /** The lock object if acquired */
  lock?: Lock;
  /** Error if not acquired */
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_TTL_MS = 30000; // 30 seconds
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 200;
const DEFAULT_RETRY_JITTER = 0.3;
const DEFAULT_DRIFT_FACTOR = 0.01;
const KEY_PREFIX = 'lock:';

// Lua script for acquiring lock atomically
const ACQUIRE_SCRIPT = `
  if redis.call('exists', KEYS[1]) == 0 then
    redis.call('set', KEYS[1], ARGV[1], 'PX', ARGV[2])
    return 1
  end
  return 0
`;

// Lua script for releasing lock atomically (only if we own it)
const RELEASE_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0
`;

// Lua script for extending lock atomically (only if we own it)
const EXTEND_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('pexpire', KEYS[1], ARGV[2])
  end
  return 0
`;

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRIBUTED LOCK SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class DistributedLockService {
  private redis: Redis;
  private config: Required<DistributedLockConfig>;
  private activeLocks: Map<string, Lock> = new Map();

  constructor(config: DistributedLockConfig) {
    this.redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 5000,
      commandTimeout: 3000,
    });

    this.config = {
      redisUrl: config.redisUrl,
      keyPrefix: config.keyPrefix || KEY_PREFIX,
      defaultTTL: config.defaultTTL || DEFAULT_TTL_MS,
      retryCount: config.retryCount ?? DEFAULT_RETRY_COUNT,
      retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY_MS,
      retryJitter: config.retryJitter ?? DEFAULT_RETRY_JITTER,
      driftFactor: config.driftFactor ?? DEFAULT_DRIFT_FACTOR,
      onAcquire: config.onAcquire || (() => {}),
      onRelease: config.onRelease || (() => {}),
      onExtend: config.onExtend || (() => {}),
      onFail: config.onFail || (() => {}),
    };

    // Register Lua scripts
    this.redis.defineCommand('acquireLock', {
      numberOfKeys: 1,
      lua: ACQUIRE_SCRIPT,
    });

    this.redis.defineCommand('releaseLock', {
      numberOfKeys: 1,
      lua: RELEASE_SCRIPT,
    });

    this.redis.defineCommand('extendLock', {
      numberOfKeys: 1,
      lua: EXTEND_SCRIPT,
    });
  }

  /**
   * Acquire a distributed lock
   */
  async acquire(resource: string, options?: AcquireOptions): Promise<Lock | null> {
    const ttlMs = options?.ttlMs || this.config.defaultTTL;
    const retryCount = options?.retryCount ?? this.config.retryCount;
    const retryDelay = options?.retryDelay ?? this.config.retryDelay;

    const lockKey = this.getLockKey(resource);
    const lockValue = this.generateLockValue();

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const startTime = Date.now();

        // Try to acquire the lock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (this.redis as any).acquireLock(
          lockKey,
          lockValue,
          ttlMs
        );

        if (result === 1) {
          // Lock acquired
          // Calculate actual expiry accounting for drift
          const drift = Math.floor(ttlMs * this.config.driftFactor) + 2;
          const validity = ttlMs - (Date.now() - startTime) - drift;

          if (validity > 0) {
            const lock: Lock = {
              resource,
              value: lockValue,
              expiry: Date.now() + validity,
              extensions: 0,
            };

            this.activeLocks.set(resource, lock);
            this.config.onAcquire(resource, ttlMs);

            return lock;
          }

          // Lock expired before we could finish, release it
          await this.forceRelease(lockKey, lockValue);
        }

        // Wait before retry
        if (attempt < retryCount) {
          const jitter = Math.random() * this.config.retryJitter * retryDelay;
          await this.sleep(retryDelay + jitter);
        }
      } catch (error) {
        console.error(`[DistributedLock] Error acquiring lock for ${resource}:`, error);

        if (attempt === retryCount) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.config.onFail(resource, err);
          return null;
        }
      }
    }

    this.config.onFail(resource, new Error('Failed to acquire lock after retries'));
    return null;
  }

  /**
   * Release a lock
   */
  async release(lock: Lock): Promise<boolean> {
    const lockKey = this.getLockKey(lock.resource);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (this.redis as any).releaseLock(lockKey, lock.value);

      if (result === 1) {
        this.activeLocks.delete(lock.resource);
        this.config.onRelease(lock.resource);
        return true;
      }

      // Lock doesn't exist or we don't own it
      this.activeLocks.delete(lock.resource);
      return false;
    } catch (error) {
      console.error(`[DistributedLock] Error releasing lock for ${lock.resource}:`, error);
      this.activeLocks.delete(lock.resource);
      return false;
    }
  }

  /**
   * Extend lock TTL
   */
  async extend(lock: Lock, ttlMs?: number): Promise<boolean> {
    const newTTL = ttlMs || this.config.defaultTTL;
    const lockKey = this.getLockKey(lock.resource);

    // Check if lock is still valid
    if (Date.now() >= lock.expiry) {
      console.warn(`[DistributedLock] Cannot extend expired lock: ${lock.resource}`);
      return false;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (this.redis as any).extendLock(lockKey, lock.value, newTTL);

      if (result === 1) {
        // Update local lock state
        lock.expiry = Date.now() + newTTL;
        lock.extensions++;
        this.activeLocks.set(lock.resource, lock);
        this.config.onExtend(lock.resource, newTTL);
        return true;
      }

      // Lock doesn't exist or we don't own it
      this.activeLocks.delete(lock.resource);
      return false;
    } catch (error) {
      console.error(`[DistributedLock] Error extending lock for ${lock.resource}:`, error);
      return false;
    }
  }

  /**
   * Check if a lock is still valid locally
   */
  isValid(lock: Lock): boolean {
    return Date.now() < lock.expiry;
  }

  /**
   * Execute an operation while holding a lock
   */
  async withLock<T>(
    resource: string,
    operation: (lock: Lock) => Promise<T>,
    options?: AcquireOptions & { autoExtend?: boolean; extendInterval?: number }
  ): Promise<T> {
    const lock = await this.acquire(resource, options);

    if (!lock) {
      throw new LockAcquisitionError(`Failed to acquire lock: ${resource}`);
    }

    let extendTimer: NodeJS.Timeout | undefined;

    try {
      // Set up auto-extension if requested
      if (options?.autoExtend) {
        const interval = options.extendInterval || Math.floor((options?.ttlMs || this.config.defaultTTL) / 3);
        extendTimer = setInterval(async () => {
          if (!this.isValid(lock)) {
            clearInterval(extendTimer);
            return;
          }
          await this.extend(lock);
        }, interval);
      }

      return await operation(lock);
    } finally {
      if (extendTimer) {
        clearInterval(extendTimer);
      }
      await this.release(lock);
    }
  }

  /**
   * Get lock status (for debugging)
   */
  async getStatus(resource: string): Promise<{
    locked: boolean;
    ttlMs?: number;
    ownedByUs: boolean;
  }> {
    const lockKey = this.getLockKey(resource);
    const localLock = this.activeLocks.get(resource);

    try {
      const [value, ttl] = await Promise.all([
        this.redis.get(lockKey),
        this.redis.pttl(lockKey),
      ]);

      return {
        locked: value !== null,
        ttlMs: ttl > 0 ? ttl : undefined,
        ownedByUs: localLock ? value === localLock.value : false,
      };
    } catch (error) {
      return { locked: false, ownedByUs: false };
    }
  }

  /**
   * Get all active locks held by this instance
   */
  getActiveLocks(): Lock[] {
    return Array.from(this.activeLocks.values()).filter((lock) =>
      this.isValid(lock)
    );
  }

  /**
   * Gracefully shutdown and release all locks
   */
  async shutdown(): Promise<void> {
    // Release all active locks
    const releases = Array.from(this.activeLocks.values()).map((lock) =>
      this.release(lock).catch(() => {})
    );
    await Promise.all(releases);

    // Close Redis connection
    await this.redis.quit();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private getLockKey(resource: string): string {
    return `${this.config.keyPrefix}${resource}`;
  }

  private generateLockValue(): string {
    // Generate a unique value combining timestamp and random bytes
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(16).toString('hex');
    return `${timestamp}:${random}`;
  }

  private async forceRelease(lockKey: string, lockValue: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.redis as any).releaseLock(lockKey, lockValue);
    } catch {
      // Ignore errors on force release
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE LOCK HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a lock resource key for AFIP invoice sequence
 */
export function getAfipSequenceLockKey(
  orgId: string,
  invoiceType: string
): string {
  return `afip_sequence:${orgId}:${invoiceType}`;
}

/**
 * Generate a lock resource key for payment processing
 */
export function getPaymentLockKey(paymentId: string): string {
  return `payment:${paymentId}`;
}

/**
 * Generate a lock resource key for job assignment
 */
export function getJobAssignmentLockKey(jobId: string): string {
  return `job_assignment:${jobId}`;
}

/**
 * Generate a lock resource key for webhook processing
 */
export function getWebhookLockKey(
  provider: string,
  webhookId: string
): string {
  return `webhook:${provider}:${webhookId}`;
}

/**
 * Generate a lock resource key for customer phone number
 */
export function getCustomerPhoneLockKey(
  orgId: string,
  phone: string
): string {
  return `customer_phone:${orgId}:${phone}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASSES
// ═══════════════════════════════════════════════════════════════════════════════

export class LockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockError';
  }
}

export class LockAcquisitionError extends LockError {
  constructor(message: string) {
    super(message);
    this.name = 'LockAcquisitionError';
  }
}

export class LockExtensionError extends LockError {
  constructor(message: string) {
    super(message);
    this.name = 'LockExtensionError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let distributedLockService: DistributedLockService | null = null;

/**
 * Initialize the global distributed lock service
 */
export function initializeDistributedLockService(
  config: DistributedLockConfig
): DistributedLockService {
  if (distributedLockService) {
    console.warn('[DistributedLock] Service already initialized');
    return distributedLockService;
  }

  distributedLockService = new DistributedLockService(config);
  return distributedLockService;
}

/**
 * Get the global distributed lock service
 */
export function getDistributedLockService(): DistributedLockService {
  if (!distributedLockService) {
    throw new Error('Distributed lock service not initialized');
  }
  return distributedLockService;
}

/**
 * Shutdown the global distributed lock service
 */
export async function shutdownDistributedLockService(): Promise<void> {
  if (distributedLockService) {
    await distributedLockService.shutdown();
    distributedLockService = null;
  }
}
