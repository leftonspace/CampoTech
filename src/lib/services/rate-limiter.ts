/**
 * Rate Limiter Service
 * ====================
 *
 * Token bucket rate limiting with Redis backend.
 * Supports per-org, per-user, and per-endpoint limits.
 */

import { Redis } from 'ioredis';
import { Request, Response, NextFunction } from 'express';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitConfig {
  /** Maximum requests in window */
  max: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Identifier for the limit */
  name: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in window */
  remaining: number;
  /** Total requests allowed */
  limit: number;
  /** Seconds until window resets */
  resetInSeconds: number;
  /** Number of requests made in window */
  current: number;
}

export interface RateLimiterConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Key prefix */
  keyPrefix?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESET LIMITS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pre-configured rate limits
 */
export const RateLimits = {
  // API limits per organization
  API_STANDARD: { name: 'api:standard', max: 1000, windowSeconds: 60 },
  API_BURST: { name: 'api:burst', max: 100, windowSeconds: 1 },

  // Auth limits
  AUTH_LOGIN: { name: 'auth:login', max: 5, windowSeconds: 60 },
  AUTH_OTP: { name: 'auth:otp', max: 3, windowSeconds: 60 },
  AUTH_REFRESH: { name: 'auth:refresh', max: 30, windowSeconds: 60 },

  // Integration limits (per org)
  AFIP_CAE: { name: 'afip:cae', max: 100, windowSeconds: 60 },
  WHATSAPP_MESSAGE: { name: 'whatsapp:message', max: 200, windowSeconds: 60 },
  WHATSAPP_VOICE: { name: 'whatsapp:voice', max: 20, windowSeconds: 60 },

  // Resource limits
  UPLOAD: { name: 'upload', max: 50, windowSeconds: 60 },
  EXPORT: { name: 'export', max: 10, windowSeconds: 60 },
  BULK_OPERATION: { name: 'bulk', max: 5, windowSeconds: 60 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════════

export class RateLimiter {
  private redis: Redis;
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.redis = new Redis(config.redisUrl);
    this.config = {
      keyPrefix: config.keyPrefix || 'ratelimit:',
      ...config,
    };
  }

  /**
   * Check if request is allowed under rate limit
   */
  async check(
    identifier: string,
    limit: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = this.getKey(limit.name, identifier);
    const now = Date.now();
    const windowStart = now - (limit.windowSeconds * 1000);

    // Use Redis sorted set for sliding window
    const multi = this.redis.multi();

    // Remove expired entries
    multi.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    multi.zcard(key);

    // Get TTL for reset time
    multi.pttl(key);

    const results = await multi.exec();

    if (!results) {
      throw new Error('Redis transaction failed');
    }

    const current = (results[1][1] as number) || 0;
    const ttl = (results[2][1] as number) || 0;

    const remaining = Math.max(0, limit.max - current);
    const resetInSeconds = ttl > 0 ? Math.ceil(ttl / 1000) : limit.windowSeconds;

    return {
      allowed: current < limit.max,
      remaining,
      limit: limit.max,
      resetInSeconds,
      current,
    };
  }

  /**
   * Consume a token from the rate limit
   */
  async consume(
    identifier: string,
    limit: RateLimitConfig,
    tokens: number = 1
  ): Promise<RateLimitResult> {
    const key = this.getKey(limit.name, identifier);
    const now = Date.now();
    const windowStart = now - (limit.windowSeconds * 1000);

    // Lua script for atomic check-and-increment
    const script = `
      -- Remove expired entries
      redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])

      -- Count current requests
      local current = redis.call('ZCARD', KEYS[1])

      -- Check if allowed
      if current + tonumber(ARGV[3]) > tonumber(ARGV[4]) then
        return {0, current, redis.call('PTTL', KEYS[1])}
      end

      -- Add new request(s)
      for i = 1, tonumber(ARGV[3]) do
        redis.call('ZADD', KEYS[1], ARGV[2], ARGV[2] .. ':' .. i .. ':' .. math.random())
      end

      -- Set expiry
      redis.call('PEXPIRE', KEYS[1], ARGV[5])

      -- Return result
      return {1, current + tonumber(ARGV[3]), tonumber(ARGV[5])}
    `;

    const result = await this.redis.eval(
      script,
      1,
      key,
      windowStart,
      now,
      tokens,
      limit.max,
      limit.windowSeconds * 1000
    ) as [number, number, number];

    const [allowed, current, ttl] = result;

    return {
      allowed: allowed === 1,
      remaining: Math.max(0, limit.max - current),
      limit: limit.max,
      resetInSeconds: Math.ceil(ttl / 1000),
      current,
    };
  }

  /**
   * Reset rate limit for identifier
   */
  async reset(identifier: string, limit: RateLimitConfig): Promise<void> {
    const key = this.getKey(limit.name, identifier);
    await this.redis.del(key);
  }

  /**
   * Get current rate limit status without consuming
   */
  async status(
    identifier: string,
    limit: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.check(identifier, limit);
  }

  /**
   * Get combined status for multiple limits
   */
  async statusMultiple(
    identifier: string,
    limits: RateLimitConfig[]
  ): Promise<Map<string, RateLimitResult>> {
    const results = new Map<string, RateLimitResult>();

    await Promise.all(
      limits.map(async (limit) => {
        const status = await this.status(identifier, limit);
        results.set(limit.name, status);
      })
    );

    return results;
  }

  /**
   * Check multiple limits, return first that fails
   */
  async checkMultiple(
    identifier: string,
    limits: RateLimitConfig[]
  ): Promise<{ allowed: boolean; failedLimit?: RateLimitConfig; results: Map<string, RateLimitResult> }> {
    const results = new Map<string, RateLimitResult>();

    for (const limit of limits) {
      const result = await this.check(identifier, limit);
      results.set(limit.name, result);

      if (!result.allowed) {
        return {
          allowed: false,
          failedLimit: limit,
          results,
        };
      }
    }

    return { allowed: true, results };
  }

  /**
   * Get full key for storage
   */
  private getKey(name: string, identifier: string): string {
    return `${this.config.keyPrefix}${name}:${identifier}`;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.redis.quit();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitMiddlewareOptions {
  /** Rate limit configuration */
  limit: RateLimitConfig;
  /** Function to extract identifier from request */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Custom response handler */
  onLimitReached?: (req: Request, res: Response, result: RateLimitResult) => void;
  /** Add rate limit headers to response */
  headers?: boolean;
}

/**
 * Create Express rate limiting middleware
 */
export function rateLimitMiddleware(
  rateLimiter: RateLimiter,
  options: RateLimitMiddlewareOptions
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const {
    limit,
    keyGenerator = defaultKeyGenerator,
    skip,
    onLimitReached,
    headers = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if should skip
    if (skip && skip(req)) {
      return next();
    }

    const identifier = keyGenerator(req);

    try {
      const result = await rateLimiter.consume(identifier, limit);

      // Add headers
      if (headers) {
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + result.resetInSeconds);
      }

      if (!result.allowed) {
        if (onLimitReached) {
          onLimitReached(req, res, result);
        } else {
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Rate limit exceeded. Try again in ${result.resetInSeconds} seconds.`,
              retryAfter: result.resetInSeconds,
            },
          });
        }
        return;
      }

      next();
    } catch (error) {
      // On error, fail open (allow request)
      console.error('Rate limiter error:', error);
      next();
    }
  };
}

/**
 * Default key generator - uses IP and optionally org ID
 */
function defaultKeyGenerator(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const orgId = (req as any).auth?.orgId;

  return orgId ? `${orgId}:${ip}` : ip;
}

/**
 * Key generator for organization-only limits
 */
export function orgKeyGenerator(req: Request): string {
  const orgId = (req as any).auth?.orgId;
  return orgId || 'anonymous';
}

/**
 * Key generator for user-specific limits
 */
export function userKeyGenerator(req: Request): string {
  const userId = (req as any).auth?.userId;
  const orgId = (req as any).auth?.orgId;

  if (userId) {
    return `${orgId}:${userId}`;
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let rateLimiter: RateLimiter | null = null;

/**
 * Initialize the global rate limiter
 */
export function initializeRateLimiter(config: RateLimiterConfig): void {
  rateLimiter = new RateLimiter(config);
}

/**
 * Get the global rate limiter
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    throw new Error('Rate limiter not initialized');
  }
  return rateLimiter;
}
