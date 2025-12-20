/**
 * CampoTech Rate Limiting (Phase 6.1)
 * ====================================
 *
 * Tier-based rate limiting using Upstash Ratelimit with sliding window algorithm.
 * Protects API endpoints from abuse while providing fair access per subscription tier.
 *
 * Rate Limits per Tier (requests per minute):
 * - FREE: 30/min - Basic protection for trial users
 * - BASICO (Inicial): 100/min - For independent workers
 * - PROFESIONAL: 500/min - For small businesses
 * - EMPRESARIAL: 2000/min - For medium businesses
 *
 * @see https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 */

import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/cache';
import { type SubscriptionTier } from '@/lib/config/tier-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rate limit configuration per subscription tier
 * Values are requests per minute using sliding window
 */
export const RATE_LIMITS: Record<SubscriptionTier, { requests: number; window: string }> = {
  FREE: { requests: 30, window: '1 m' },
  INICIAL: { requests: 100, window: '1 m' },
  PROFESIONAL: { requests: 500, window: '1 m' },
  EMPRESA: { requests: 2000, window: '1 m' },
};

/**
 * Special rate limits for specific endpoint categories
 */
export const ENDPOINT_RATE_LIMITS = {
  /** Auth endpoints (login, register) - stricter to prevent brute force */
  auth: { requests: 10, window: '1 m' },
  /** Webhook endpoints - higher limit for external integrations */
  webhooks: { requests: 1000, window: '1 m' },
  /** File upload endpoints - stricter due to resource usage */
  uploads: { requests: 20, window: '1 m' },
  /** AI/LLM endpoints - very limited due to cost */
  ai: { requests: 10, window: '1 m' },
} as const;

export type EndpointCategory = keyof typeof ENDPOINT_RATE_LIMITS;

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER INSTANCES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse window string to milliseconds
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) return 60000; // Default 1 minute

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 60000;
  }
}

/**
 * Check if rate limiting is configured (Redis available)
 */
export function isRateLimitingConfigured(): boolean {
  return redis !== null;
}

/**
 * Create a rate limiter for a specific tier
 */
function createTierRateLimiter(tier: SubscriptionTier): Ratelimit | null {
  if (!redis) return null;

  const config = RATE_LIMITS[tier];
  const windowMs = parseWindow(config.window);

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, `${windowMs} ms`),
    prefix: `ratelimit:tier:${tier.toLowerCase()}`,
    analytics: true,
  });
}

/**
 * Create a rate limiter for a specific endpoint category
 */
function createEndpointRateLimiter(category: EndpointCategory): Ratelimit | null {
  if (!redis) return null;

  const config = ENDPOINT_RATE_LIMITS[category];
  const windowMs = parseWindow(config.window);

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, `${windowMs} ms`),
    prefix: `ratelimit:endpoint:${category}`,
    analytics: true,
  });
}

// Cached rate limiter instances
const tierLimiters: Map<SubscriptionTier, Ratelimit | null> = new Map();
const endpointLimiters: Map<EndpointCategory, Ratelimit | null> = new Map();

/**
 * Get or create a tier-based rate limiter
 */
function getTierLimiter(tier: SubscriptionTier): Ratelimit | null {
  if (!tierLimiters.has(tier)) {
    tierLimiters.set(tier, createTierRateLimiter(tier));
  }
  return tierLimiters.get(tier) || null;
}

/**
 * Get or create an endpoint-based rate limiter
 */
function getEndpointLimiter(category: EndpointCategory): Ratelimit | null {
  if (!endpointLimiters.has(category)) {
    endpointLimiters.set(category, createEndpointRateLimiter(category));
  }
  return endpointLimiters.get(category) || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT RESULT
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Total limit for this identifier */
  limit: number;
  /** Unix timestamp when the rate limit resets */
  reset: number;
  /** Milliseconds until reset */
  retryAfter: number;
  /** The identifier used for rate limiting */
  identifier: string;
  /** The tier or category applied */
  appliedLimit: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE RATE LIMITING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check rate limit for a user/organization based on their subscription tier
 *
 * @param identifier - Unique identifier (usually orgId or IP for anonymous)
 * @param tier - Subscription tier (defaults to FREE)
 * @returns Rate limit result with success status and metadata
 *
 * @example
 * const result = await checkRateLimit(orgId, 'PROFESIONAL');
 * if (!result.success) {
 *   return new Response('Rate limit exceeded', {
 *     status: 429,
 *     headers: getRateLimitHeaders(result),
 *   });
 * }
 */
export async function checkRateLimit(
  identifier: string,
  tier: SubscriptionTier = 'FREE'
): Promise<RateLimitResult> {
  const limiter = getTierLimiter(tier);
  const config = RATE_LIMITS[tier];

  // If no limiter (Redis not configured), allow all requests
  if (!limiter) {
    return {
      success: true,
      remaining: config.requests,
      limit: config.requests,
      reset: Date.now() + parseWindow(config.window),
      retryAfter: 0,
      identifier,
      appliedLimit: tier,
    };
  }

  try {
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      remaining: result.remaining,
      limit: result.limit,
      reset: result.reset,
      retryAfter: result.success ? 0 : Math.max(0, result.reset - Date.now()),
      identifier,
      appliedLimit: tier,
    };
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // On error, fail open (allow the request)
    return {
      success: true,
      remaining: config.requests,
      limit: config.requests,
      reset: Date.now() + parseWindow(config.window),
      retryAfter: 0,
      identifier,
      appliedLimit: tier,
    };
  }
}

/**
 * Check rate limit for specific endpoint categories
 *
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param category - Endpoint category (auth, webhooks, uploads, ai)
 * @returns Rate limit result
 *
 * @example
 * // For login attempts
 * const result = await checkEndpointRateLimit(ip, 'auth');
 */
export async function checkEndpointRateLimit(
  identifier: string,
  category: EndpointCategory
): Promise<RateLimitResult> {
  const limiter = getEndpointLimiter(category);
  const config = ENDPOINT_RATE_LIMITS[category];

  // If no limiter, allow all requests
  if (!limiter) {
    return {
      success: true,
      remaining: config.requests,
      limit: config.requests,
      reset: Date.now() + parseWindow(config.window),
      retryAfter: 0,
      identifier,
      appliedLimit: `endpoint:${category}`,
    };
  }

  try {
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      remaining: result.remaining,
      limit: result.limit,
      reset: result.reset,
      retryAfter: result.success ? 0 : Math.max(0, result.reset - Date.now()),
      identifier,
      appliedLimit: `endpoint:${category}`,
    };
  } catch (error) {
    console.error('[RateLimit] Error checking endpoint rate limit:', error);
    return {
      success: true,
      remaining: config.requests,
      limit: config.requests,
      reset: Date.now() + parseWindow(config.window),
      retryAfter: 0,
      identifier,
      appliedLimit: `endpoint:${category}`,
    };
  }
}

/**
 * Combined rate limit check - applies both tier and endpoint limits
 *
 * @param identifier - Unique identifier
 * @param tier - Subscription tier
 * @param endpointCategory - Optional endpoint category for additional limiting
 * @returns The most restrictive rate limit result
 */
export async function checkCombinedRateLimit(
  identifier: string,
  tier: SubscriptionTier = 'FREE',
  endpointCategory?: EndpointCategory
): Promise<RateLimitResult> {
  // Always check tier limit
  const tierResult = await checkRateLimit(identifier, tier);

  // If tier limit exceeded, return immediately
  if (!tierResult.success) {
    return tierResult;
  }

  // If endpoint category specified, also check that
  if (endpointCategory) {
    const endpointResult = await checkEndpointRateLimit(identifier, endpointCategory);

    // Return the more restrictive result
    if (!endpointResult.success) {
      return endpointResult;
    }

    // Both passed - return the one with fewer remaining
    return endpointResult.remaining < tierResult.remaining
      ? endpointResult
      : tierResult;
  }

  return tierResult;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get standard rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
    ...(result.retryAfter > 0
      ? { 'Retry-After': Math.ceil(result.retryAfter / 1000).toString() }
      : {}),
  };
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  message?: string
): Response {
  const retryAfterSeconds = Math.ceil(result.retryAfter / 1000);

  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: message || `Límite de solicitudes excedido. Intente de nuevo en ${retryAfterSeconds} segundos.`,
      retryAfter: retryAfterSeconds,
      limit: result.limit,
      reset: result.reset,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...getRateLimitHeaders(result),
      },
    }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDENTIFIER EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract client IP from request headers
 * Handles various proxy configurations
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;

  // Check common proxy headers
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, get the first (original client)
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Vercel-specific header
  const vercelForwarded = headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) {
    return vercelForwarded.split(',')[0].trim();
  }

  // Fallback - this shouldn't happen in production
  return 'unknown';
}

/**
 * Determine rate limit identifier from request
 * Uses organization ID if authenticated, IP otherwise
 */
export function getRateLimitIdentifier(
  request: Request,
  orgId?: string,
  userId?: string
): string {
  // Prefer organization ID for authenticated requests
  if (orgId) {
    return `org:${orgId}`;
  }

  // Use user ID if available but no org
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP for anonymous requests
  return `ip:${getClientIp(request)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT CATEGORY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect endpoint category from pathname for special rate limiting
 */
export function detectEndpointCategory(pathname: string): EndpointCategory | null {
  // Auth endpoints
  if (
    pathname.includes('/auth/') ||
    pathname.includes('/login') ||
    pathname.includes('/register') ||
    pathname.includes('/signin') ||
    pathname.includes('/signup')
  ) {
    return 'auth';
  }

  // Webhook endpoints
  if (pathname.includes('/webhook') || pathname.includes('/hooks/')) {
    return 'webhooks';
  }

  // Upload endpoints
  if (
    pathname.includes('/upload') ||
    pathname.includes('/files') ||
    pathname.includes('/media')
  ) {
    return 'uploads';
  }

  // AI/LLM endpoints
  if (
    pathname.includes('/ai/') ||
    pathname.includes('/chat/') ||
    pathname.includes('/completion') ||
    pathname.includes('/assistant')
  ) {
    return 'ai';
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS & MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get rate limit analytics for monitoring
 * Note: Requires Upstash Analytics to be enabled
 */
export async function getRateLimitAnalytics(): Promise<{
  configured: boolean;
  message: string;
}> {
  if (!isRateLimitingConfigured()) {
    return {
      configured: false,
      message: 'Rate limiting not configured - Redis not available',
    };
  }

  return {
    configured: true,
    message: 'Rate limiting configured. View analytics in Upstash dashboard.',
  };
}

/**
 * Manually block an identifier (for abuse prevention)
 */
export async function blockIdentifier(
  identifier: string,
  durationMs: number = 3600000 // 1 hour default
): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.set(
      `ratelimit:blocked:${identifier}`,
      { blockedAt: Date.now(), duration: durationMs },
      { px: durationMs }
    );
    return true;
  } catch (error) {
    console.error('[RateLimit] Error blocking identifier:', error);
    return false;
  }
}

/**
 * Check if an identifier is manually blocked
 */
export async function isBlocked(identifier: string): Promise<boolean> {
  if (!redis) return false;

  try {
    const blocked = await redis.get(`ratelimit:blocked:${identifier}`);
    return blocked !== null;
  } catch (error) {
    console.error('[RateLimit] Error checking blocked status:', error);
    return false;
  }
}

/**
 * Unblock an identifier
 */
export async function unblockIdentifier(identifier: string): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.del(`ratelimit:blocked:${identifier}`);
    return true;
  } catch (error) {
    console.error('[RateLimit] Error unblocking identifier:', error);
    return false;
  }
}
