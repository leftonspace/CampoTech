/**
 * CampoTech Caching Layer (Phase 5.2)
 * ===================================
 *
 * Redis-based caching using Upstash for serverless deployments.
 * Provides caching utilities for common queries to handle 100K+ businesses.
 *
 * TTL Guidelines:
 * - Organization settings: 1 hour (3600s) - changes infrequently
 * - Tier limits: 24 hours (86400s) - static configuration
 * - Public profiles: 5 minutes (300s) - moderate freshness for marketplace
 * - Search results: 1 minute (60s) - needs to be fresh
 *
 * @see https://upstash.com/docs/redis/overall/getstarted
 */

// Note: @upstash/redis must be installed: npm install @upstash/redis
// eslint-disable-next-line @typescript-eslint/no-require-imports
let Redis: typeof import('@upstash/redis').Redis;
try {
  // Dynamic import to handle cases where package isn't installed yet
  Redis = require('@upstash/redis').Redis;
} catch {
  // Package not installed - will use null client
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS CLIENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// Redis client type
type RedisClient = InstanceType<typeof import('@upstash/redis').Redis>;

/**
 * Create Redis client instance
 * Uses Upstash REST API which is ideal for serverless/edge deployments
 */
function createRedisClient(): RedisClient | null {
  if (!Redis) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[Cache] @upstash/redis not installed. Run: npm install @upstash/redis'
      );
    }
    return null;
  }

  if (!isRedisConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[Cache] Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Falling back to no-cache mode.'
      );
    }
    return null;
  }

  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// Singleton Redis client
export const redis = createRedisClient();

// ═══════════════════════════════════════════════════════════════════════════════
// TTL CONSTANTS (in seconds)
// ═══════════════════════════════════════════════════════════════════════════════

export const CACHE_TTL = {
  /** Organization settings - 1 hour */
  ORGANIZATION_SETTINGS: 3600,
  /** Tier limits/configuration - 24 hours */
  TIER_LIMITS: 86400,
  /** Public profiles for marketplace - 5 minutes */
  PUBLIC_PROFILES: 300,
  /** Search results - 1 minute */
  SEARCH_RESULTS: 60,
  /** User session data - 15 minutes */
  USER_SESSION: 900,
  /** Feature flags - 5 minutes */
  FEATURE_FLAGS: 300,
  /** Rate limit windows - varies by type */
  RATE_LIMIT: 60,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE KEY PREFIXES (for organization and namespacing)
// ═══════════════════════════════════════════════════════════════════════════════

export const CACHE_PREFIX = {
  /** Organization settings: org:settings:{orgId} */
  ORG_SETTINGS: 'org:settings',
  /** Tier limits: tier:limits:{tierId} */
  TIER_LIMITS: 'tier:limits',
  /** Public profile: profile:public:{orgId} */
  PUBLIC_PROFILE: 'profile:public',
  /** Search results: search:{hash} */
  SEARCH: 'search',
  /** User data: user:{userId} */
  USER: 'user',
  /** Feature flags: features:{orgId} */
  FEATURES: 'features',
  /** Rate limiting: ratelimit:{identifier} */
  RATE_LIMIT: 'ratelimit',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE KEY BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build cache key for organization settings
 */
export function orgSettingsKey(orgId: string): string {
  return `${CACHE_PREFIX.ORG_SETTINGS}:${orgId}`;
}

/**
 * Build cache key for tier limits
 */
export function tierLimitsKey(tier: string): string {
  return `${CACHE_PREFIX.TIER_LIMITS}:${tier}`;
}

/**
 * Build cache key for public profile
 */
export function publicProfileKey(orgId: string): string {
  return `${CACHE_PREFIX.PUBLIC_PROFILE}:${orgId}`;
}

/**
 * Build cache key for search results
 * Uses a hash of search parameters for uniqueness
 */
export function searchResultsKey(queryHash: string): string {
  return `${CACHE_PREFIX.SEARCH}:${queryHash}`;
}

/**
 * Build cache key for user data
 */
export function userKey(userId: string): string {
  return `${CACHE_PREFIX.USER}:${userId}`;
}

/**
 * Build cache key for feature flags
 */
export function featureFlagsKey(orgId: string): string {
  return `${CACHE_PREFIX.FEATURES}:${orgId}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE CACHE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a value from cache
 * Returns null if not found or Redis not configured
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const value = await redis.get<T>(key);
    return value;
  } catch (error) {
    console.error(`[Cache] Error getting key ${key}:`, error);
    return null;
  }
}

/**
 * Set a value in cache with TTL
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = CACHE_TTL.SEARCH_RESULTS
): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.error(`[Cache] Error setting key ${key}:`, error);
    return false;
  }
}

/**
 * Delete a key from cache
 */
export async function cacheDelete(key: string): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`[Cache] Error deleting key ${key}:`, error);
    return false;
  }
}

/**
 * Delete multiple keys matching a pattern
 * Note: Use sparingly as SCAN can be expensive
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  if (!redis) return 0;

  try {
    let cursor = 0;
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      });
      cursor = Number(nextCursor);

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== 0);

    return deletedCount;
  } catch (error) {
    console.error(`[Cache] Error deleting pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Check if a key exists in cache
 */
export async function cacheExists(key: string): Promise<boolean> {
  if (!redis) return false;

  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error(`[Cache] Error checking key ${key}:`, error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE-ASIDE PATTERN (Read-Through with Fallback)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a value from cache, or compute and cache it if not found
 *
 * This implements the cache-aside (lazy loading) pattern:
 * 1. Check cache for the value
 * 2. If found, return it
 * 3. If not found, execute the fetch function
 * 4. Cache the result and return it
 *
 * @param key - Cache key
 * @param fn - Function to compute the value if not cached
 * @param ttlSeconds - Time to live in seconds (default: 5 minutes)
 * @returns The cached or computed value
 *
 * @example
 * const settings = await cached(
 *   `org:settings:${orgId}`,
 *   () => prisma.organization.findUnique({ where: { id: orgId } }),
 *   3600 // 1 hour
 * );
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL.SEARCH_RESULTS
): Promise<T> {
  // If Redis not configured, just execute the function
  if (!redis) {
    return fn();
  }

  try {
    // Try to get from cache
    const cachedValue = await redis.get<T>(key);
    if (cachedValue !== null && cachedValue !== undefined) {
      return cachedValue;
    }

    // Not in cache, execute function
    const result = await fn();

    // Cache the result (don't await to not block the response)
    redis.set(key, result, { ex: ttlSeconds }).catch((error: unknown) => {
      console.error(`[Cache] Error caching key ${key}:`, error);
    });

    return result;
  } catch (error) {
    console.error(`[Cache] Error in cached() for key ${key}:`, error);
    // Fallback to direct execution
    return fn();
  }
}

/**
 * Cache-aside with stale-while-revalidate pattern
 *
 * Returns stale data immediately while refreshing in background.
 * Useful for data that can be slightly stale for better performance.
 *
 * @param key - Cache key
 * @param fn - Function to compute the value
 * @param ttlSeconds - Time to live before considered stale
 * @param staleTtlSeconds - Additional time to serve stale data while revalidating
 */
export async function cachedWithSWR<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL.SEARCH_RESULTS,
  staleTtlSeconds: number = 60
): Promise<T> {
  if (!redis) {
    return fn();
  }

  const metaKey = `${key}:meta`;

  try {
    // Get cached value and metadata
    const [cachedValue, meta] = await Promise.all([
      redis.get<T>(key),
      redis.get<{ cachedAt: number }>(metaKey),
    ]);

    const now = Date.now();
    const cachedAt = meta?.cachedAt || 0;
    const age = (now - cachedAt) / 1000;

    // If we have a cached value
    if (cachedValue !== null && cachedValue !== undefined) {
      // If still fresh, return it
      if (age < ttlSeconds) {
        return cachedValue;
      }

      // If stale but within SWR window, return it and revalidate in background
      if (age < ttlSeconds + staleTtlSeconds) {
        // Trigger background revalidation
        fn()
          .then((result) => {
            redis.set(key, result, { ex: ttlSeconds + staleTtlSeconds });
            redis.set(metaKey, { cachedAt: Date.now() }, { ex: ttlSeconds + staleTtlSeconds });
          })
          .catch(console.error);

        return cachedValue;
      }
    }

    // Cache miss or too stale - fetch fresh data
    const result = await fn();

    // Cache result with metadata
    await Promise.all([
      redis.set(key, result, { ex: ttlSeconds + staleTtlSeconds }),
      redis.set(metaKey, { cachedAt: now }, { ex: ttlSeconds + staleTtlSeconds }),
    ]);

    return result;
  } catch (error) {
    console.error(`[Cache] Error in cachedWithSWR() for key ${key}:`, error);
    return fn();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE INVALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Invalidate organization-related caches when org settings change
 */
export async function invalidateOrgCache(orgId: string): Promise<void> {
  if (!redis) return;

  const keysToDelete = [
    orgSettingsKey(orgId),
    publicProfileKey(orgId),
    featureFlagsKey(orgId),
  ];

  try {
    await redis.del(...keysToDelete);
    // Also invalidate search results that might include this org
    await cacheDeletePattern(`${CACHE_PREFIX.SEARCH}:*`);
  } catch (error) {
    console.error(`[Cache] Error invalidating org cache for ${orgId}:`, error);
  }
}

/**
 * Invalidate user-related caches
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(userKey(userId));
  } catch (error) {
    console.error(`[Cache] Error invalidating user cache for ${userId}:`, error);
  }
}

/**
 * Invalidate all search result caches
 */
export async function invalidateSearchCache(): Promise<void> {
  if (!redis) return;

  try {
    await cacheDeletePattern(`${CACHE_PREFIX.SEARCH}:*`);
  } catch (error) {
    console.error('[Cache] Error invalidating search cache:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a hash for search query parameters
 * Used to create unique cache keys for search results
 */
export function hashSearchQuery(params: Record<string, unknown>): string {
  // Sort keys for consistent hashing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);

  // Simple hash using JSON stringification
  const str = JSON.stringify(sortedParams);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cache statistics (for monitoring)
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  dbSize?: number;
} | null> {
  if (!redis) {
    return { connected: false };
  }

  try {
    // Use ping to check connection and dbsize for stats
    // Note: Upstash Redis doesn't support INFO command
    await redis.ping();
    const dbSize = await redis.dbsize();

    return {
      connected: true,
      dbSize,
    };
  } catch (error: unknown) {
    console.error('[Cache] Error getting stats:', error);
    return { connected: false };
  }
}

// Export everything
export {
  type Redis,
};
