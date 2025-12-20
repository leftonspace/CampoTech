/**
 * Database Fallback Types (Phase 6B.2)
 * =====================================
 *
 * Type definitions for cached read fallbacks and write queue.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CACHED READ FALLBACK TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CacheStrategy = 'cache-first' | 'db-first' | 'stale-while-revalidate';

export interface CachedReadConfig {
  /** Default TTL for cached data (seconds) */
  defaultTtlSeconds: number;
  /** Maximum stale time before data is considered unusable (seconds) */
  maxStalenessSeconds: number;
  /** Enable fallback to stale cache when DB is unavailable */
  enableStaleFallback: boolean;
  /** Minimum freshness required for critical data (seconds) */
  criticalDataMaxAge: number;
  /** Log cache hits/misses for monitoring */
  enableMetrics: boolean;
}

export const DEFAULT_CACHED_READ_CONFIG: CachedReadConfig = {
  defaultTtlSeconds: 300, // 5 minutes
  maxStalenessSeconds: 3600, // 1 hour max stale
  enableStaleFallback: true,
  criticalDataMaxAge: 60, // 1 minute for critical data
  enableMetrics: true,
};

export interface CachedData<T> {
  data: T;
  cachedAt: number; // Unix timestamp
  ttlSeconds: number;
  source: 'database' | 'cache' | 'stale-cache';
}

export interface CacheReadResult<T> {
  data: T | null;
  source: 'database' | 'cache' | 'stale-cache' | 'miss';
  age: number; // seconds since cached
  isStale: boolean;
  error?: string;
}

export interface CachedReadMetrics {
  cacheHits: number;
  cacheMisses: number;
  dbFetches: number;
  staleFallbacks: number;
  errors: number;
  avgFetchTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE QUEUE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type WriteOperationType = 'create' | 'update' | 'delete' | 'upsert';

export type WriteQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

export interface QueuedWrite<T = unknown> {
  id: string;
  model: string;
  operation: WriteOperationType;
  data: T;
  where?: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
  status: WriteQueueStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
  idempotencyKey?: string;
  organizationId?: string;
  userId?: string;
}

export interface WriteQueueConfig {
  /** Maximum queue size before rejecting new writes */
  maxQueueSize: number;
  /** Maximum retry attempts per write */
  maxRetries: number;
  /** Base delay between retries (ms) */
  retryBaseDelay: number;
  /** Maximum retry delay (ms) */
  retryMaxDelay: number;
  /** Batch size for processing */
  batchSize: number;
  /** Processing interval (ms) */
  processInterval: number;
  /** Enable write queue (can be disabled for immediate writes) */
  enabled: boolean;
  /** Connection error threshold before enabling queue */
  errorThreshold: number;
  /** Time window for error threshold (ms) */
  errorWindowMs: number;
}

export const DEFAULT_WRITE_QUEUE_CONFIG: WriteQueueConfig = {
  maxQueueSize: 10000,
  maxRetries: 5,
  retryBaseDelay: 1000,
  retryMaxDelay: 60000,
  batchSize: 50,
  processInterval: 1000,
  enabled: true,
  errorThreshold: 5,
  errorWindowMs: 60000,
};

export interface WriteQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  totalQueued: number;
  totalProcessed: number;
  avgProcessingTime: number;
  oldestPendingAge: number | null;
  isProcessing: boolean;
  isHealthy: boolean;
  dbAvailable: boolean;
}

export interface WriteQueueResult {
  success: boolean;
  writeId: string;
  queued: boolean;
  message: string;
  estimatedProcessTime?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE HEALTH TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type DbHealthStatus = 'healthy' | 'degraded' | 'unavailable';

export interface DbHealthState {
  status: DbHealthStatus;
  lastCheck: Date;
  latency: number;
  consecutiveErrors: number;
  recentErrors: Array<{
    timestamp: Date;
    error: string;
  }>;
  writeQueueEnabled: boolean;
  cachedReadEnabled: boolean;
}

export interface DbCircuitState {
  isOpen: boolean;
  openedAt: Date | null;
  failureCount: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  nextRetryAt: Date | null;
}
