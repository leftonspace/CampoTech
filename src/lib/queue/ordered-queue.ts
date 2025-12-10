/**
 * Ordered Queue Implementation
 * ============================
 *
 * Provides ordering guarantees for queue processing using distributed locks.
 *
 * Ordering Modes:
 * - GLOBAL_FIFO: One job at a time globally (reconciliation, migrations)
 * - ORG_FIFO: Per-organization ordering (AFIP invoices, WhatsApp messages)
 * - ENTITY_FIFO: Per-entity ordering (offline sync per-job)
 */

import { Queue, Job, Worker } from 'bullmq';
import { getRedis } from '../redis/redis-manager';
import { log } from '../logging/logger';

// =============================================================================
// TYPES
// =============================================================================

export type OrderingMode = 'GLOBAL_FIFO' | 'ORG_FIFO' | 'ENTITY_FIFO' | 'NONE';

export interface OrderedQueueConfig {
  /** Queue name */
  name: string;
  /** Ordering mode */
  orderingMode: OrderingMode;
  /** Lock TTL in milliseconds */
  lockTtlMs?: number;
  /** Lock acquisition timeout in milliseconds */
  lockTimeoutMs?: number;
  /** How long to wait before retrying lock acquisition */
  lockRetryDelayMs?: number;
  /** Maximum concurrent jobs (per ordering key) */
  maxConcurrent?: number;
}

export interface OrderedJobData {
  /** Organization ID */
  orgId: string;
  /** Entity ID (for ENTITY_FIFO mode) */
  entityId?: string;
  /** Entity type (for ENTITY_FIFO mode) */
  entityType?: string;
  /** Original job data */
  payload: any;
  /** Sequence number (auto-generated for ordering) */
  sequenceNumber?: number;
}

// =============================================================================
// LOCK MANAGER
// =============================================================================

const LOCK_PREFIX = 'ordered:lock:';

class LockManager {
  private redis;
  private lockTtlMs: number;
  private lockTimeoutMs: number;
  private lockRetryDelayMs: number;
  private heldLocks: Map<string, { token: string; renewInterval: NodeJS.Timeout }> = new Map();

  constructor(options: {
    lockTtlMs?: number;
    lockTimeoutMs?: number;
    lockRetryDelayMs?: number;
  } = {}) {
    this.redis = getRedis();
    this.lockTtlMs = options.lockTtlMs || 30000; // 30 seconds
    this.lockTimeoutMs = options.lockTimeoutMs || 10000; // 10 seconds
    this.lockRetryDelayMs = options.lockRetryDelayMs || 100; // 100ms
  }

  /**
   * Acquire a lock for the given key
   */
  async acquire(key: string): Promise<boolean> {
    const lockKey = `${LOCK_PREFIX}${key}`;
    const token = `${process.pid}:${Date.now()}:${Math.random()}`;

    const startTime = Date.now();

    while (Date.now() - startTime < this.lockTimeoutMs) {
      // Try to acquire lock
      const result = await this.redis.set(lockKey, token, 'PX', this.lockTtlMs, 'NX');

      if (result === 'OK') {
        // Lock acquired - start renewal
        const renewInterval = setInterval(async () => {
          try {
            await this.renew(key, token);
          } catch (error) {
            log.error('Lock renewal failed', { key, error });
          }
        }, this.lockTtlMs / 2);

        this.heldLocks.set(key, { token, renewInterval });
        return true;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, this.lockRetryDelayMs));
    }

    // Timeout - could not acquire lock
    return false;
  }

  /**
   * Renew a lock
   */
  private async renew(key: string, token: string): Promise<boolean> {
    const lockKey = `${LOCK_PREFIX}${key}`;

    // Lua script to renew only if we still own the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, token, this.lockTtlMs);
    return result === 1;
  }

  /**
   * Release a lock
   */
  async release(key: string): Promise<boolean> {
    const lockKey = `${LOCK_PREFIX}${key}`;
    const held = this.heldLocks.get(key);

    if (!held) {
      return false;
    }

    // Stop renewal
    clearInterval(held.renewInterval);
    this.heldLocks.delete(key);

    // Lua script to release only if we still own the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, held.token);
    return result === 1;
  }

  /**
   * Check if a lock is held
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = `${LOCK_PREFIX}${key}`;
    const result = await this.redis.exists(lockKey);
    return result === 1;
  }

  /**
   * Release all held locks (for shutdown)
   */
  async releaseAll(): Promise<void> {
    for (const key of this.heldLocks.keys()) {
      await this.release(key);
    }
  }
}

// =============================================================================
// SEQUENCE GENERATOR
// =============================================================================

const SEQUENCE_PREFIX = 'ordered:seq:';

class SequenceGenerator {
  private redis;

  constructor() {
    this.redis = getRedis();
  }

  /**
   * Get next sequence number for a key
   */
  async next(key: string): Promise<number> {
    const seqKey = `${SEQUENCE_PREFIX}${key}`;
    return this.redis.incr(seqKey);
  }

  /**
   * Get current sequence number
   */
  async current(key: string): Promise<number> {
    const seqKey = `${SEQUENCE_PREFIX}${key}`;
    const result = await this.redis.get(seqKey);
    return result ? parseInt(result, 10) : 0;
  }

  /**
   * Reset sequence number
   */
  async reset(key: string): Promise<void> {
    const seqKey = `${SEQUENCE_PREFIX}${key}`;
    await this.redis.del(seqKey);
  }
}

// =============================================================================
// ORDERED QUEUE
// =============================================================================

export class OrderedQueue {
  private config: OrderedQueueConfig;
  private queue: Queue;
  private lockManager: LockManager;
  private sequenceGenerator: SequenceGenerator;

  constructor(config: OrderedQueueConfig) {
    this.config = {
      lockTtlMs: 30000,
      lockTimeoutMs: 10000,
      lockRetryDelayMs: 100,
      maxConcurrent: 1,
      ...config,
    };

    this.queue = new Queue(config.name, {
      connection: getRedis(),
    });

    this.lockManager = new LockManager({
      lockTtlMs: this.config.lockTtlMs,
      lockTimeoutMs: this.config.lockTimeoutMs,
      lockRetryDelayMs: this.config.lockRetryDelayMs,
    });

    this.sequenceGenerator = new SequenceGenerator();
  }

  /**
   * Get the ordering key for a job based on the ordering mode
   */
  private getOrderingKey(data: OrderedJobData): string {
    switch (this.config.orderingMode) {
      case 'GLOBAL_FIFO':
        return `global:${this.config.name}`;
      case 'ORG_FIFO':
        return `org:${this.config.name}:${data.orgId}`;
      case 'ENTITY_FIFO':
        if (!data.entityType || !data.entityId) {
          throw new Error('ENTITY_FIFO requires entityType and entityId');
        }
        return `entity:${this.config.name}:${data.orgId}:${data.entityType}:${data.entityId}`;
      case 'NONE':
      default:
        return `none:${Date.now()}:${Math.random()}`; // No ordering
    }
  }

  /**
   * Add a job to the ordered queue
   */
  async add(
    name: string,
    data: OrderedJobData,
    opts?: { priority?: number }
  ): Promise<Job<OrderedJobData>> {
    // Generate sequence number for ordering
    const orderingKey = this.getOrderingKey(data);
    const sequenceNumber = await this.sequenceGenerator.next(orderingKey);

    const jobData: OrderedJobData = {
      ...data,
      sequenceNumber,
    };

    return this.queue.add(name, jobData, {
      priority: opts?.priority,
      // Use sequence number in job ID for natural ordering
      jobId: `${orderingKey}:${sequenceNumber.toString().padStart(10, '0')}`,
    });
  }

  /**
   * Create a worker that respects ordering
   */
  createWorker(
    processor: (job: Job<OrderedJobData>) => Promise<any>,
    opts?: { concurrency?: number }
  ): Worker {
    const worker = new Worker(
      this.config.name,
      async (job: Job<OrderedJobData>) => {
        const orderingKey = this.getOrderingKey(job.data);

        // Acquire lock before processing
        const acquired = await this.lockManager.acquire(orderingKey);

        if (!acquired) {
          // Could not acquire lock - delay and retry
          await job.moveToDelayed(Date.now() + (this.config.lockRetryDelayMs || 100));
          throw new Error('Could not acquire ordering lock');
        }

        try {
          return await processor(job);
        } finally {
          // Always release lock
          await this.lockManager.release(orderingKey);
        }
      },
      {
        connection: getRedis(),
        concurrency: opts?.concurrency || this.config.maxConcurrent || 1,
      }
    );

    return worker;
  }

  /**
   * Get the underlying queue
   */
  getQueue(): Queue {
    return this.queue;
  }

  /**
   * Shutdown the ordered queue
   */
  async shutdown(): Promise<void> {
    await this.lockManager.releaseAll();
    await this.queue.close();
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an ordered queue for AFIP invoices (per-org ordering)
 */
export function createAfipOrderedQueue(): OrderedQueue {
  return new OrderedQueue({
    name: 'afip-ordered',
    orderingMode: 'ORG_FIFO',
    lockTtlMs: 60000, // 60 second lock for AFIP (can be slow)
    maxConcurrent: 1,
  });
}

/**
 * Create an ordered queue for WhatsApp messages (per-org ordering)
 */
export function createWhatsAppOrderedQueue(): OrderedQueue {
  return new OrderedQueue({
    name: 'whatsapp-ordered',
    orderingMode: 'ORG_FIFO',
    lockTtlMs: 30000,
    maxConcurrent: 1,
  });
}

/**
 * Create an ordered queue for offline sync (per-entity ordering)
 */
export function createOfflineSyncOrderedQueue(): OrderedQueue {
  return new OrderedQueue({
    name: 'offline-sync-ordered',
    orderingMode: 'ENTITY_FIFO',
    lockTtlMs: 30000,
    maxConcurrent: 1,
  });
}

/**
 * Create an ordered queue for reconciliation (global ordering)
 */
export function createReconciliationOrderedQueue(): OrderedQueue {
  return new OrderedQueue({
    name: 'reconciliation-ordered',
    orderingMode: 'GLOBAL_FIFO',
    lockTtlMs: 300000, // 5 minute lock for reconciliation
    maxConcurrent: 1,
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  LockManager,
  SequenceGenerator,
};
