/**
 * Cached Read Fallback System (Phase 6B.2.1)
 * ==========================================
 *
 * Provides resilient database reads with automatic cache fallback.
 * When the database is unavailable, returns cached/stale data.
 *
 * Usage:
 * ```typescript
 * import { cachedRead, getCachedReadManager } from '@/lib/db/fallback';
 *
 * // Simple cached read
 * const user = await cachedRead('user', userId, () =>
 *   prisma.user.findUnique({ where: { id: userId } })
 * );
 *
 * // With custom TTL
 * const settings = await cachedRead(
 *   'org-settings',
 *   orgId,
 *   () => prisma.organizationSettings.findUnique({ where: { organizationId: orgId } }),
 *   { ttlSeconds: 3600 }
 * );
 * ```
 */

import { redis, cacheGet, cacheSet } from '@/lib/cache';
import {
  CachedReadConfig,
  DEFAULT_CACHED_READ_CONFIG,
  CachedData,
  CacheReadResult,
  CachedReadMetrics,
  CacheStrategy,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// CACHED READ MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class CachedReadManager {
  private config: CachedReadConfig;
  private metrics: CachedReadMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    dbFetches: 0,
    staleFallbacks: 0,
    errors: 0,
    avgFetchTime: 0,
  };
  private fetchTimes: number[] = [];
  private maxFetchTimeSamples = 100;
  private dbAvailable = true;
  private lastDbCheck = Date.now();
  private dbCheckInterval = 5000; // Check DB every 5 seconds when unavailable

  constructor(config: Partial<CachedReadConfig> = {}) {
    this.config = { ...DEFAULT_CACHED_READ_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CACHED READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Perform a cached read with automatic fallback
   */
  async read<T>(
    entityType: string,
    entityId: string,
    fetchFn: () => Promise<T | null>,
    options: {
      ttlSeconds?: number;
      strategy?: CacheStrategy;
      isCritical?: boolean;
      allowStale?: boolean;
    } = {}
  ): Promise<CacheReadResult<T>> {
    const {
      ttlSeconds = this.config.defaultTtlSeconds,
      strategy = 'db-first',
      isCritical = false,
      allowStale = this.config.enableStaleFallback,
    } = options;

    const cacheKey = this.buildCacheKey(entityType, entityId);

    try {
      switch (strategy) {
        case 'cache-first':
          return this.cacheFirstRead(cacheKey, fetchFn, ttlSeconds, isCritical, allowStale);

        case 'stale-while-revalidate':
          return this.swrRead(cacheKey, fetchFn, ttlSeconds, allowStale);

        case 'db-first':
        default:
          return this.dbFirstRead(cacheKey, fetchFn, ttlSeconds, isCritical, allowStale);
      }
    } catch (error) {
      this.metrics.errors++;
      console.error(`[CachedRead] Error reading ${entityType}:${entityId}:`, error);

      // Try to return stale data as last resort
      if (allowStale) {
        const staleResult = await this.getStaleData<T>(cacheKey);
        if (staleResult) {
          return staleResult;
        }
      }

      return {
        data: null,
        source: 'miss',
        age: 0,
        isStale: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * DB-first strategy: Try database, fall back to cache
   */
  private async dbFirstRead<T>(
    cacheKey: string,
    fetchFn: () => Promise<T | null>,
    ttlSeconds: number,
    isCritical: boolean,
    allowStale: boolean
  ): Promise<CacheReadResult<T>> {
    // If DB is known to be unavailable, skip directly to cache
    if (!this.dbAvailable && !this.shouldRetryDb()) {
      return this.cacheFirstRead(cacheKey, fetchFn, ttlSeconds, isCritical, allowStale);
    }

    const startTime = Date.now();

    try {
      const data = await fetchFn();
      this.recordDbSuccess(Date.now() - startTime);
      this.metrics.dbFetches++;

      // Cache the result
      if (data !== null) {
        await this.cacheData(cacheKey, data, ttlSeconds);
      }

      return {
        data,
        source: 'database',
        age: 0,
        isStale: false,
      };
    } catch (error) {
      this.recordDbFailure(error);

      // Fall back to cache
      if (allowStale) {
        const cachedResult = await this.getCachedData<T>(cacheKey, isCritical);
        if (cachedResult.data !== null) {
          this.metrics.staleFallbacks++;
          return cachedResult;
        }
      }

      throw error;
    }
  }

  /**
   * Cache-first strategy: Check cache first, then DB
   */
  private async cacheFirstRead<T>(
    cacheKey: string,
    fetchFn: () => Promise<T | null>,
    ttlSeconds: number,
    isCritical: boolean,
    allowStale: boolean
  ): Promise<CacheReadResult<T>> {
    // Check cache first
    const cachedResult = await this.getCachedData<T>(cacheKey, isCritical);

    if (cachedResult.data !== null && !cachedResult.isStale) {
      this.metrics.cacheHits++;
      return cachedResult;
    }

    // Cache miss or stale - try database
    if (this.dbAvailable || this.shouldRetryDb()) {
      const startTime = Date.now();

      try {
        const data = await fetchFn();
        this.recordDbSuccess(Date.now() - startTime);
        this.metrics.dbFetches++;

        if (data !== null) {
          await this.cacheData(cacheKey, data, ttlSeconds);
        }

        return {
          data,
          source: 'database',
          age: 0,
          isStale: false,
        };
      } catch (error) {
        this.recordDbFailure(error);

        // Return stale data if available
        if (allowStale && cachedResult.data !== null) {
          this.metrics.staleFallbacks++;
          return cachedResult;
        }

        throw error;
      }
    }

    // DB unavailable - return stale if allowed
    if (allowStale && cachedResult.data !== null) {
      this.metrics.staleFallbacks++;
      return cachedResult;
    }

    this.metrics.cacheMisses++;
    return {
      data: null,
      source: 'miss',
      age: 0,
      isStale: false,
      error: 'Database unavailable and no cached data',
    };
  }

  /**
   * Stale-while-revalidate strategy: Return cache immediately, refresh in background
   */
  private async swrRead<T>(
    cacheKey: string,
    fetchFn: () => Promise<T | null>,
    ttlSeconds: number,
    allowStale: boolean
  ): Promise<CacheReadResult<T>> {
    // Get from cache
    const cachedResult = await this.getCachedData<T>(cacheKey, false);

    if (cachedResult.data !== null) {
      this.metrics.cacheHits++;

      // If stale, trigger background refresh
      if (cachedResult.isStale && (this.dbAvailable || this.shouldRetryDb())) {
        this.backgroundRefresh(cacheKey, fetchFn, ttlSeconds);
      }

      return cachedResult;
    }

    // No cache - must fetch from DB
    return this.dbFirstRead(cacheKey, fetchFn, ttlSeconds, false, allowStale);
  }

  /**
   * Background refresh for SWR strategy
   */
  private backgroundRefresh<T>(
    cacheKey: string,
    fetchFn: () => Promise<T | null>,
    ttlSeconds: number
  ): void {
    // Don't await - runs in background
    (async () => {
      try {
        const startTime = Date.now();
        const data = await fetchFn();
        this.recordDbSuccess(Date.now() - startTime);

        if (data !== null) {
          await this.cacheData(cacheKey, data, ttlSeconds);
        }
      } catch (error) {
        this.recordDbFailure(error);
        console.warn('[CachedRead] Background refresh failed:', error);
      }
    })();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CACHE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get data from cache with staleness check
   */
  private async getCachedData<T>(
    key: string,
    isCritical: boolean
  ): Promise<CacheReadResult<T>> {
    const cached = await cacheGet<CachedData<T>>(key);

    if (!cached) {
      return { data: null, source: 'miss', age: 0, isStale: false };
    }

    const age = Math.floor((Date.now() - cached.cachedAt) / 1000);
    const maxAge = isCritical
      ? this.config.criticalDataMaxAge
      : cached.ttlSeconds;
    const isStale = age > maxAge;
    const isTooStale = age > this.config.maxStalenessSeconds;

    if (isTooStale) {
      return { data: null, source: 'miss', age, isStale: true };
    }

    return {
      data: cached.data,
      source: isStale ? 'stale-cache' : 'cache',
      age,
      isStale,
    };
  }

  /**
   * Get stale data as last resort
   */
  private async getStaleData<T>(key: string): Promise<CacheReadResult<T> | null> {
    const cached = await cacheGet<CachedData<T>>(key);

    if (!cached) {
      return null;
    }

    const age = Math.floor((Date.now() - cached.cachedAt) / 1000);

    // Only return if not too stale
    if (age <= this.config.maxStalenessSeconds) {
      return {
        data: cached.data,
        source: 'stale-cache',
        age,
        isStale: true,
      };
    }

    return null;
  }

  /**
   * Cache data with metadata
   */
  private async cacheData<T>(
    key: string,
    data: T,
    ttlSeconds: number
  ): Promise<void> {
    const cached: CachedData<T> = {
      data,
      cachedAt: Date.now(),
      ttlSeconds,
      source: 'database',
    };

    // Store with extended TTL to allow stale reads
    const extendedTtl = ttlSeconds + this.config.maxStalenessSeconds;
    await cacheSet(key, cached, extendedTtl);
  }

  /**
   * Build cache key for entity
   */
  private buildCacheKey(entityType: string, entityId: string): string {
    return `cached:${entityType}:${entityId}`;
  }

  /**
   * Invalidate cached entity
   */
  async invalidate(entityType: string, entityId: string): Promise<void> {
    if (!redis) return;

    const key = this.buildCacheKey(entityType, entityId);
    try {
      await redis.del(key);
    } catch (error) {
      console.error('[CachedRead] Error invalidating cache:', error);
    }
  }

  /**
   * Invalidate all cached entities of a type
   */
  async invalidateType(entityType: string): Promise<void> {
    if (!redis) return;

    const pattern = `cached:${entityType}:*`;
    try {
      let cursor = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, {
          match: pattern,
          count: 100,
        });
        cursor = Number(nextCursor);

        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== 0);
    } catch (error) {
      console.error('[CachedRead] Error invalidating type:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DATABASE HEALTH TRACKING
  // ─────────────────────────────────────────────────────────────────────────────

  private recordDbSuccess(latency: number): void {
    this.dbAvailable = true;
    this.lastDbCheck = Date.now();
    this.recordFetchTime(latency);
  }

  private recordDbFailure(error: unknown): void {
    this.dbAvailable = false;
    this.lastDbCheck = Date.now();
    console.warn('[CachedRead] DB failure recorded:', error instanceof Error ? error.message : error);
  }

  private shouldRetryDb(): boolean {
    return Date.now() - this.lastDbCheck >= this.dbCheckInterval;
  }

  private recordFetchTime(time: number): void {
    this.fetchTimes.push(time);
    if (this.fetchTimes.length > this.maxFetchTimeSamples) {
      this.fetchTimes.shift();
    }
    this.metrics.avgFetchTime =
      this.fetchTimes.reduce((a, b) => a + b, 0) / this.fetchTimes.length;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS & METRICS
  // ─────────────────────────────────────────────────────────────────────────────

  getMetrics(): CachedReadMetrics {
    return { ...this.metrics };
  }

  isDbAvailable(): boolean {
    return this.dbAvailable;
  }

  getStatus(): {
    dbAvailable: boolean;
    cacheHitRate: number;
    staleFallbackRate: number;
    avgFetchTime: number;
  } {
    const totalReads =
      this.metrics.cacheHits +
      this.metrics.cacheMisses +
      this.metrics.dbFetches;

    return {
      dbAvailable: this.dbAvailable,
      cacheHitRate: totalReads > 0 ? this.metrics.cacheHits / totalReads : 0,
      staleFallbackRate:
        totalReads > 0 ? this.metrics.staleFallbacks / totalReads : 0,
      avgFetchTime: this.metrics.avgFetchTime,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      dbFetches: 0,
      staleFallbacks: 0,
      errors: 0,
      avgFetchTime: 0,
    };
    this.fetchTimes = [];
  }

  /**
   * Force DB status for testing
   */
  setDbAvailable(available: boolean): void {
    this.dbAvailable = available;
    this.lastDbCheck = Date.now();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON & CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

let cachedReadManager: CachedReadManager | null = null;

export function getCachedReadManager(): CachedReadManager {
  if (!cachedReadManager) {
    cachedReadManager = new CachedReadManager();
  }
  return cachedReadManager;
}

export function resetCachedReadManager(): void {
  cachedReadManager = null;
}

/**
 * Convenience function for cached reads
 */
export async function cachedRead<T>(
  entityType: string,
  entityId: string,
  fetchFn: () => Promise<T | null>,
  options?: {
    ttlSeconds?: number;
    strategy?: CacheStrategy;
    isCritical?: boolean;
    allowStale?: boolean;
  }
): Promise<T | null> {
  const manager = getCachedReadManager();
  const result = await manager.read(entityType, entityId, fetchFn, options);
  return result.data;
}

/**
 * Cached read with full result info
 */
export async function cachedReadWithInfo<T>(
  entityType: string,
  entityId: string,
  fetchFn: () => Promise<T | null>,
  options?: {
    ttlSeconds?: number;
    strategy?: CacheStrategy;
    isCritical?: boolean;
    allowStale?: boolean;
  }
): Promise<CacheReadResult<T>> {
  const manager = getCachedReadManager();
  return manager.read(entityType, entityId, fetchFn, options);
}
