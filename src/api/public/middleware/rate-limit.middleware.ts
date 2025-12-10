/**
 * Rate Limit Middleware
 * =====================
 *
 * Implements rate limiting for API endpoints using a sliding window algorithm.
 * Supports per-API-key and per-IP rate limiting.
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { RateLimitInfo, ApiRequestContext } from '../public-api.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_RATE_LIMIT = 60; // requests per minute
const DEFAULT_BURST_LIMIT = 10; // extra burst capacity
const WINDOW_SIZE_MS = 60 * 1000; // 1 minute

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore: Map<string, { requests: number[]; lastCleanup: number }> = new Map();

// Cleanup interval (every 5 minutes)
setInterval(() => cleanupExpiredEntries(), 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitOptions {
  requestsPerMinute?: number;
  burstLimit?: number;
  keyGenerator?: (req: Request) => string;
  skipFailedRequests?: boolean;
  skip?: (req: Request) => boolean;
}

export function createRateLimitMiddleware(pool: Pool, options: RateLimitOptions = {}) {
  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Check if should skip
      if (options.skip && options.skip(req)) {
        next();
        return;
      }

      // Generate rate limit key
      const key = options.keyGenerator
        ? options.keyGenerator(req)
        : generateDefaultKey(req);

      // Get rate limit for this key
      const limit = await getRateLimit(pool, req, options.requestsPerMinute);
      const burstLimit = options.burstLimit || DEFAULT_BURST_LIMIT;
      const totalLimit = limit + burstLimit;

      // Check rate limit
      const rateLimitInfo = checkRateLimit(key, totalLimit);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitInfo.remaining).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetAt.getTime() / 1000).toString());

      if (rateLimitInfo.remaining < 0) {
        // Rate limit exceeded
        res.setHeader('Retry-After', rateLimitInfo.retryAfter?.toString() || '60');
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Please retry after ${rateLimitInfo.retryAfter} seconds.`,
            details: {
              limit,
              resetAt: rateLimitInfo.resetAt.toISOString(),
              retryAfter: rateLimitInfo.retryAfter,
            },
          },
        });
        return;
      }

      // Record this request
      recordRequest(key);

      // Attach rate limit info to request
      (req as any).rateLimit = rateLimitInfo;

      next();
    } catch (error) {
      console.error('[RateLimitMiddleware] Error:', error);
      // On error, allow the request but log it
      next();
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function generateDefaultKey(req: Request): string {
  const context = (req as any).apiContext as ApiRequestContext | undefined;

  // Prefer API key ID, then OAuth client ID, then IP address
  if (context?.apiKeyId) {
    return `api_key:${context.apiKeyId}`;
  }
  if (context?.oauthClientId) {
    return `oauth:${context.oauthClientId}`;
  }

  // Fall back to IP address
  const ip = getClientIp(req);
  return `ip:${ip}`;
}

async function getRateLimit(
  pool: Pool,
  req: Request,
  defaultLimit?: number
): Promise<number> {
  const context = (req as any).apiContext as ApiRequestContext | undefined;

  // If using API key, get its rate limit
  if (context?.apiKeyId) {
    try {
      const result = await pool.query(
        'SELECT rate_limit FROM api_keys WHERE id = $1',
        [context.apiKeyId]
      );
      if (result.rows.length > 0 && result.rows[0].rate_limit) {
        return result.rows[0].rate_limit;
      }
    } catch (error) {
      console.error('[RateLimit] Error fetching API key rate limit:', error);
    }
  }

  return defaultLimit || DEFAULT_RATE_LIMIT;
}

function checkRateLimit(key: string, limit: number): RateLimitInfo {
  const now = Date.now();
  const windowStart = now - WINDOW_SIZE_MS;

  // Get or create entry
  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { requests: [], lastCleanup: now };
    rateLimitStore.set(key, entry);
  }

  // Clean up old requests
  if (now - entry.lastCleanup > 10000) {
    entry.requests = entry.requests.filter((t) => t > windowStart);
    entry.lastCleanup = now;
  }

  // Count requests in current window
  const requestsInWindow = entry.requests.filter((t) => t > windowStart).length;
  const remaining = limit - requestsInWindow - 1; // -1 for current request

  // Calculate reset time
  const oldestRequest = entry.requests.find((t) => t > windowStart);
  const resetAt = oldestRequest
    ? new Date(oldestRequest + WINDOW_SIZE_MS)
    : new Date(now + WINDOW_SIZE_MS);

  // Calculate retry after
  let retryAfter: number | undefined;
  if (remaining < 0) {
    retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);
  }

  return {
    limit,
    remaining,
    resetAt,
    retryAfter,
  };
}

function recordRequest(key: string): void {
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry) {
    entry = { requests: [], lastCleanup: now };
    rateLimitStore.set(key, entry);
  }

  entry.requests.push(now);
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  const expirationThreshold = now - WINDOW_SIZE_MS * 2;

  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove if no requests in the last 2 windows
    const hasRecentRequests = entry.requests.some((t) => t > expirationThreshold);
    if (!hasRecentRequests) {
      rateLimitStore.delete(key);
    }
  }
}

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED RATE LIMITERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Per-endpoint rate limiter with different limits per endpoint
 */
export function createEndpointRateLimiter(
  pool: Pool,
  endpointLimits: Record<string, number>
) {
  return createRateLimitMiddleware(pool, {
    keyGenerator: (req) => {
      const context = (req as any).apiContext as ApiRequestContext | undefined;
      const baseKey = context?.apiKeyId || context?.oauthClientId || getClientIp(req);
      const endpoint = `${req.method}:${req.route?.path || req.path}`;
      return `${baseKey}:${endpoint}`;
    },
    requestsPerMinute: DEFAULT_RATE_LIMIT,
  });
}

/**
 * Tier-based rate limiter (e.g., free, pro, enterprise)
 */
export interface TierConfig {
  tier: string;
  requestsPerMinute: number;
  requestsPerDay?: number;
}

export function createTieredRateLimiter(
  pool: Pool,
  tierConfigs: TierConfig[],
  getTier: (req: Request) => Promise<string>
) {
  return async function tieredRateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tier = await getTier(req);
      const config = tierConfigs.find((c) => c.tier === tier) || tierConfigs[0];

      const middleware = createRateLimitMiddleware(pool, {
        requestsPerMinute: config.requestsPerMinute,
      });

      await middleware(req, res, next);
    } catch (error) {
      console.error('[TieredRateLimiter] Error:', error);
      next();
    }
  };
}
