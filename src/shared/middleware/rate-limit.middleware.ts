/**
 * Rate Limiting Middleware
 * ========================
 *
 * Token bucket rate limiting to prevent abuse.
 * Uses in-memory storage (use Redis for production clustering).
 */

import { Request, Response, NextFunction } from 'express';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Key generator function */
  keyGenerator?: (req: Request) => string;
  /** Skip function - return true to skip rate limiting */
  skip?: (req: Request) => boolean;
  /** Handler for rate limit exceeded */
  handler?: (req: Request, res: Response, next: NextFunction) => void;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY STORE
// ═══════════════════════════════════════════════════════════════════════════════

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  }
}, 60000);

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

function defaultKeyGenerator(req: Request): string {
  // Use orgId + userId if authenticated, otherwise IP
  if (req.auth?.orgId && req.auth?.userId) {
    return `${req.auth.orgId}:${req.auth.userId}`;
  }

  // Get client IP
  const forwarded = req.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
  return `ip:${ip}`;
}

function defaultHandler(req: Request, res: Response, next: NextFunction): void {
  const entry = store.get(defaultKeyGenerator(req));
  const retryAfter = entry ? Math.ceil((entry.resetTime - Date.now()) / 1000) : 60;

  res.status(429).json({
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      retryAfter,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    skip,
    handler = defaultHandler,
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    // Check skip condition
    if (skip?.(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    let entry = store.get(key);

    // Create or reset entry if window expired
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(key, entry);
    }

    // Increment count
    entry.count++;

    // Set headers
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));

    // Check if exceeded
    if (entry.count > maxRequests) {
      return handler(req, res, next);
    }

    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRE-CONFIGURED LIMITERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Standard API rate limiter
 * 100 requests per 15 minutes per user
 */
export const standardLimiter = rateLimit({
  maxRequests: 100,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

/**
 * Strict rate limiter for sensitive operations
 * 10 requests per 15 minutes per user
 */
export const strictLimiter = rateLimit({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
});

/**
 * Auth rate limiter
 * 5 requests per minute per IP (for login/OTP)
 */
export const authLimiter = rateLimit({
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (req) => {
    const forwarded = req.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
    return `auth:${ip}`;
  },
});

/**
 * Search rate limiter
 * 30 requests per minute (expensive operations)
 */
export const searchLimiter = rateLimit({
  maxRequests: 30,
  windowMs: 60 * 1000,
});

/**
 * Write operation limiter
 * 50 writes per 15 minutes
 */
export const writeLimiter = rateLimit({
  maxRequests: 50,
  windowMs: 15 * 60 * 1000,
  skip: (req) => req.method === 'GET', // Only applies to writes
});

/**
 * Bulk operation limiter
 * 5 bulk operations per hour
 */
export const bulkLimiter = rateLimit({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
});
