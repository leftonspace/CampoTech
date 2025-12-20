/**
 * Database Write Queue (Phase 6B.2.2)
 * ====================================
 *
 * Queues database writes when the database is under pressure.
 * Automatically processes queued writes when DB becomes available.
 *
 * Usage:
 * ```typescript
 * import { queueWrite, getWriteQueueManager } from '@/lib/db/fallback';
 *
 * // Queue a write operation
 * const result = await queueWrite('user', 'create', { name: 'John' }, {
 *   priority: 'high',
 *   idempotencyKey: 'create-user-123',
 * });
 *
 * // Check queue status
 * const stats = getWriteQueueManager().getStats();
 * ```
 */

import { redis } from '@/lib/cache';
import { db } from '@/lib/db';
import {
  WriteQueueConfig,
  DEFAULT_WRITE_QUEUE_CONFIG,
  QueuedWrite,
  WriteOperationType,
  WriteQueueStats,
  WriteQueueResult,
  WriteQueueStatus,
  DbHealthStatus,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE QUEUE MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class WriteQueueManager {
  private config: WriteQueueConfig;
  private queue: QueuedWrite[] = [];
  private processing = false;
  private processTimer: NodeJS.Timeout | null = null;
  private dbHealthStatus: DbHealthStatus = 'healthy';
  private recentErrors: Array<{ timestamp: number; error: string }> = [];
  private stats = {
    totalQueued: 0,
    totalProcessed: 0,
    totalFailed: 0,
    processingTimes: [] as number[],
  };
  private maxProcessingTimeSamples = 100;
  private listeners: Set<(event: WriteQueueEvent) => void> = new Set();

  constructor(config: Partial<WriteQueueConfig> = {}) {
    this.config = { ...DEFAULT_WRITE_QUEUE_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // QUEUE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Queue a write operation
   */
  async enqueue<T>(
    model: string,
    operation: WriteOperationType,
    data: T,
    options: {
      where?: Record<string, unknown>;
      priority?: 'high' | 'normal' | 'low';
      idempotencyKey?: string;
      organizationId?: string;
      userId?: string;
    } = {}
  ): Promise<WriteQueueResult> {
    const {
      where,
      priority = 'normal',
      idempotencyKey,
      organizationId,
      userId,
    } = options;

    // Check queue capacity
    if (this.queue.length >= this.config.maxQueueSize) {
      return {
        success: false,
        writeId: '',
        queued: false,
        message: 'Queue is full. Please try again later.',
      };
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = this.queue.find(
        (w) => w.idempotencyKey === idempotencyKey
      );
      if (existing) {
        return {
          success: true,
          writeId: existing.id,
          queued: true,
          message: 'Write already queued (idempotent)',
        };
      }
    }

    // If DB is healthy and queue is empty, try direct write
    if (
      this.dbHealthStatus === 'healthy' &&
      this.queue.length === 0 &&
      !this.shouldQueueWrites()
    ) {
      try {
        await this.executeWrite(model, operation, data, where);
        return {
          success: true,
          writeId: '',
          queued: false,
          message: 'Write completed immediately',
        };
      } catch (error) {
        this.recordDbError(error);
        // Fall through to queue
      }
    }

    // Queue the write
    const write: QueuedWrite<T> = {
      id: this.generateWriteId(),
      model,
      operation,
      data,
      where,
      priority,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.config.maxRetries,
      createdAt: new Date(),
      idempotencyKey,
      organizationId,
      userId,
    };

    // Insert by priority
    this.insertByPriority(write);
    this.stats.totalQueued++;

    // Persist to Redis if available
    await this.persistQueue();

    // Emit event
    this.emit({ type: 'enqueued', write });

    // Ensure processing is running
    this.startProcessing();

    // Estimate processing time
    const position = this.queue.findIndex((w) => w.id === write.id);
    const avgTime =
      this.stats.processingTimes.length > 0
        ? this.stats.processingTimes.reduce((a, b) => a + b, 0) /
          this.stats.processingTimes.length
        : 1000;

    return {
      success: true,
      writeId: write.id,
      queued: true,
      message: `Write queued at position ${position + 1}`,
      estimatedProcessTime: position * avgTime,
    };
  }

  /**
   * Insert write in priority order
   */
  private insertByPriority(write: QueuedWrite): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const insertPriority = priorityOrder[write.priority];

    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[this.queue[i].priority] > insertPriority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, write);
  }

  /**
   * Get write by ID
   */
  getWrite(writeId: string): QueuedWrite | undefined {
    return this.queue.find((w) => w.id === writeId);
  }

  /**
   * Cancel a queued write
   */
  cancel(writeId: string): boolean {
    const index = this.queue.findIndex((w) => w.id === writeId);
    if (index === -1) return false;

    const write = this.queue[index];
    if (write.status === 'processing') {
      return false; // Can't cancel while processing
    }

    this.queue.splice(index, 1);
    this.emit({ type: 'cancelled', write });
    this.persistQueue();
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROCESSING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Start the processing loop
   */
  startProcessing(): void {
    if (this.processTimer) return;

    this.processTimer = setInterval(() => {
      this.processNextBatch();
    }, this.config.processInterval);

    // Process immediately
    this.processNextBatch();
  }

  /**
   * Stop the processing loop
   */
  stopProcessing(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
  }

  /**
   * Process the next batch of writes
   */
  private async processNextBatch(): Promise<void> {
    if (this.processing) return;
    if (this.queue.length === 0) {
      this.stopProcessing();
      return;
    }

    // Check if we should process
    if (this.dbHealthStatus === 'unavailable' && !this.shouldRetryDb()) {
      return;
    }

    this.processing = true;

    try {
      // Get pending writes (up to batch size)
      const pending = this.queue
        .filter((w) => w.status === 'pending' || w.status === 'retrying')
        .slice(0, this.config.batchSize);

      if (pending.length === 0) {
        return;
      }

      // Process each write
      for (const write of pending) {
        await this.processWrite(write);
      }

      // Persist state
      await this.persistQueue();
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single write
   */
  private async processWrite(write: QueuedWrite): Promise<void> {
    write.status = 'processing';
    write.attempts++;

    const startTime = Date.now();

    try {
      await this.executeWrite(write.model, write.operation, write.data, write.where);

      // Success
      write.status = 'completed';
      write.processedAt = new Date();
      this.stats.totalProcessed++;
      this.recordProcessingTime(Date.now() - startTime);
      this.recordDbSuccess();

      // Remove from queue
      const index = this.queue.findIndex((w) => w.id === write.id);
      if (index !== -1) {
        this.queue.splice(index, 1);
      }

      this.emit({ type: 'completed', write });
    } catch (error) {
      this.recordDbError(error);

      if (write.attempts >= write.maxAttempts) {
        // Max retries reached
        write.status = 'failed';
        write.error = error instanceof Error ? error.message : 'Unknown error';
        this.stats.totalFailed++;
        this.emit({ type: 'failed', write, error });
      } else {
        // Schedule retry
        write.status = 'retrying';
        write.error = error instanceof Error ? error.message : 'Unknown error';
        this.emit({ type: 'retrying', write, attempt: write.attempts });
      }
    }
  }

  /**
   * Execute a database write
   */
  private async executeWrite(
    model: string,
    operation: WriteOperationType,
    data: unknown,
    where?: Record<string, unknown>
  ): Promise<void> {
    // Dynamic Prisma model access
    const prismaModel = (db as Record<string, unknown>)[model];

    if (!prismaModel || typeof prismaModel !== 'object') {
      throw new Error(`Unknown model: ${model}`);
    }

    const modelOps = prismaModel as Record<string, (...args: unknown[]) => Promise<unknown>>;

    switch (operation) {
      case 'create':
        await modelOps.create({ data });
        break;

      case 'update':
        if (!where) throw new Error('Update requires where clause');
        await modelOps.update({ where, data });
        break;

      case 'delete':
        if (!where) throw new Error('Delete requires where clause');
        await modelOps.delete({ where });
        break;

      case 'upsert':
        if (!where) throw new Error('Upsert requires where clause');
        await modelOps.upsert({
          where,
          create: data,
          update: data,
        });
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DATABASE HEALTH
  // ─────────────────────────────────────────────────────────────────────────────

  private recordDbSuccess(): void {
    this.dbHealthStatus = 'healthy';
    this.recentErrors = [];
  }

  private recordDbError(error: unknown): void {
    const now = Date.now();
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    this.recentErrors.push({ timestamp: now, error: errorMsg });

    // Clean old errors
    const windowStart = now - this.config.errorWindowMs;
    this.recentErrors = this.recentErrors.filter(
      (e) => e.timestamp > windowStart
    );

    // Update health status
    if (this.recentErrors.length >= this.config.errorThreshold) {
      this.dbHealthStatus = 'unavailable';
    } else if (this.recentErrors.length > 0) {
      this.dbHealthStatus = 'degraded';
    }
  }

  private shouldQueueWrites(): boolean {
    return (
      this.dbHealthStatus !== 'healthy' ||
      this.recentErrors.length >= this.config.errorThreshold / 2
    );
  }

  private shouldRetryDb(): boolean {
    // Retry every 5 seconds when unavailable
    const lastError = this.recentErrors[this.recentErrors.length - 1];
    if (!lastError) return true;
    return Date.now() - lastError.timestamp >= 5000;
  }

  /**
   * Force DB health status (for testing)
   */
  setDbHealth(status: DbHealthStatus): void {
    this.dbHealthStatus = status;
    if (status === 'healthy') {
      this.recentErrors = [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERSISTENCE
  // ─────────────────────────────────────────────────────────────────────────────

  private async persistQueue(): Promise<void> {
    if (!redis) return;

    try {
      // Only persist pending/retrying writes
      const toPersist = this.queue.filter(
        (w) => w.status === 'pending' || w.status === 'retrying'
      );
      await redis.set('db:write-queue', JSON.stringify(toPersist), {
        ex: 86400, // 24 hours
      });
    } catch (error) {
      console.error('[WriteQueue] Error persisting queue:', error);
    }
  }

  async loadQueue(): Promise<void> {
    if (!redis) return;

    try {
      const data = await redis.get<string>('db:write-queue');
      if (data) {
        const writes: QueuedWrite[] = JSON.parse(data);
        this.queue = writes.map((w) => ({
          ...w,
          createdAt: new Date(w.createdAt),
          processedAt: w.processedAt ? new Date(w.processedAt) : undefined,
        }));

        if (this.queue.length > 0) {
          console.log(
            `[WriteQueue] Loaded ${this.queue.length} pending writes`
          );
          this.startProcessing();
        }
      }
    } catch (error) {
      console.error('[WriteQueue] Error loading queue:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATS & MONITORING
  // ─────────────────────────────────────────────────────────────────────────────

  getStats(): WriteQueueStats {
    const pending = this.queue.filter((w) => w.status === 'pending');
    const processing = this.queue.filter((w) => w.status === 'processing');
    const retrying = this.queue.filter((w) => w.status === 'retrying');
    const failed = this.queue.filter((w) => w.status === 'failed');

    const oldestPending = pending.length > 0
      ? Date.now() - pending[0].createdAt.getTime()
      : null;

    const avgTime =
      this.stats.processingTimes.length > 0
        ? this.stats.processingTimes.reduce((a, b) => a + b, 0) /
          this.stats.processingTimes.length
        : 0;

    return {
      pending: pending.length,
      processing: processing.length,
      completed: this.stats.totalProcessed,
      failed: failed.length,
      retrying: retrying.length,
      totalQueued: this.stats.totalQueued,
      totalProcessed: this.stats.totalProcessed,
      avgProcessingTime: avgTime,
      oldestPendingAge: oldestPending,
      isProcessing: this.processing,
      isHealthy:
        this.dbHealthStatus === 'healthy' &&
        failed.length === 0 &&
        (oldestPending === null || oldestPending < 60000),
      dbAvailable: this.dbHealthStatus !== 'unavailable',
    };
  }

  getQueue(): QueuedWrite[] {
    return [...this.queue];
  }

  getDbHealth(): DbHealthStatus {
    return this.dbHealthStatus;
  }

  private recordProcessingTime(time: number): void {
    this.stats.processingTimes.push(time);
    if (this.stats.processingTimes.length > this.maxProcessingTimeSamples) {
      this.stats.processingTimes.shift();
    }
  }

  private generateWriteId(): string {
    return `write_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  subscribe(callback: (event: WriteQueueEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: WriteQueueEvent): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('[WriteQueue] Error in event listener:', error);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Clear failed writes from queue
   */
  clearFailed(): number {
    const failedCount = this.queue.filter((w) => w.status === 'failed').length;
    this.queue = this.queue.filter((w) => w.status !== 'failed');
    this.persistQueue();
    return failedCount;
  }

  /**
   * Retry all failed writes
   */
  retryFailed(): number {
    let count = 0;
    for (const write of this.queue) {
      if (write.status === 'failed') {
        write.status = 'retrying';
        write.attempts = 0;
        count++;
      }
    }

    if (count > 0) {
      this.persistQueue();
      this.startProcessing();
    }

    return count;
  }

  /**
   * Clear entire queue (use with caution)
   */
  clearQueue(): void {
    this.queue = [];
    this.persistQueue();
    this.stopProcessing();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type WriteQueueEvent =
  | { type: 'enqueued'; write: QueuedWrite }
  | { type: 'completed'; write: QueuedWrite }
  | { type: 'failed'; write: QueuedWrite; error?: unknown }
  | { type: 'retrying'; write: QueuedWrite; attempt: number }
  | { type: 'cancelled'; write: QueuedWrite };

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON & CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

let writeQueueManager: WriteQueueManager | null = null;

export function getWriteQueueManager(): WriteQueueManager {
  if (!writeQueueManager) {
    writeQueueManager = new WriteQueueManager();
    // Load persisted queue
    writeQueueManager.loadQueue().catch(console.error);
  }
  return writeQueueManager;
}

export function resetWriteQueueManager(): void {
  if (writeQueueManager) {
    writeQueueManager.stopProcessing();
  }
  writeQueueManager = null;
}

/**
 * Queue a write operation
 */
export async function queueWrite<T>(
  model: string,
  operation: WriteOperationType,
  data: T,
  options?: {
    where?: Record<string, unknown>;
    priority?: 'high' | 'normal' | 'low';
    idempotencyKey?: string;
    organizationId?: string;
    userId?: string;
  }
): Promise<WriteQueueResult> {
  const manager = getWriteQueueManager();
  return manager.enqueue(model, operation, data, options);
}

/**
 * Get queue stats
 */
export function getWriteQueueStats(): WriteQueueStats {
  const manager = getWriteQueueManager();
  return manager.getStats();
}
