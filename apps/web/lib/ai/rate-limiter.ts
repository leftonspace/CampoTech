/**
 * AI Rate Limiter
 * ================
 *
 * Phase 8 Security Remediation: P3
 * Provides AI-specific rate limiting to prevent cost abuse and API exhaustion.
 *
 * This module implements:
 * - Per-user AI request limits
 * - Per-organization daily limits
 * - Sliding window rate limiting
 * - Cost-aware throttling
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * AI operation types with different rate limit profiles
 */
export type AIOperationType =
    | 'chat_completion'
    | 'staff_assist'
    | 'copilot'
    | 'transcription'
    | 'embedding';

/**
 * Rate limit configuration per operation type
 */
interface RateLimitConfig {
    /** Maximum requests per window */
    limit: number;
    /** Window duration in seconds */
    window: number;
    /** Prefix for Redis keys */
    prefix: string;
}

const RATE_LIMIT_CONFIGS: Record<AIOperationType, RateLimitConfig> = {
    chat_completion: { limit: 30, window: 60, prefix: 'ai:chat' },
    staff_assist: { limit: 20, window: 60, prefix: 'ai:staff' },
    copilot: { limit: 40, window: 60, prefix: 'ai:copilot' },
    transcription: { limit: 10, window: 60, prefix: 'ai:transcribe' },
    embedding: { limit: 50, window: 60, prefix: 'ai:embed' },
};

/**
 * Organization daily limits (keyed by subscription tier)
 */
const ORG_DAILY_LIMITS: Record<string, number> = {
    free: 100,
    starter: 500,
    professional: 2000,
    enterprise: 10000,
    default: 500,
};

/**
 * Rate limit check result
 */
export interface AIRateLimitResult {
    /** Whether the request should proceed */
    success: boolean;
    /** Remaining requests in current window */
    remaining: number;
    /** Total limit for this window */
    limit: number;
    /** Seconds until rate limit resets */
    resetInSeconds: number;
    /** Error message if rate limited */
    error?: string;
}

/**
 * In-memory fallback for when Redis is unavailable
 */
class InMemoryRateLimiter {
    private counts: Map<string, { count: number; resetAt: number }> = new Map();

    check(key: string, limit: number, windowMs: number): AIRateLimitResult {
        const now = Date.now();
        const entry = this.counts.get(key);

        if (!entry || entry.resetAt < now) {
            // New window
            this.counts.set(key, { count: 1, resetAt: now + windowMs });
            return {
                success: true,
                remaining: limit - 1,
                limit,
                resetInSeconds: Math.ceil(windowMs / 1000),
            };
        }

        if (entry.count >= limit) {
            return {
                success: false,
                remaining: 0,
                limit,
                resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
                error: 'Rate limit exceeded',
            };
        }

        entry.count++;
        return {
            success: true,
            remaining: limit - entry.count,
            limit,
            resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
        };
    }

    // Clean up expired entries periodically
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.counts.entries()) {
            if (entry.resetAt < now) {
                this.counts.delete(key);
            }
        }
    }
}

const inMemoryLimiter = new InMemoryRateLimiter();

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => inMemoryLimiter.cleanup(), 5 * 60 * 1000);
}

/**
 * Get Redis client if configured
 */
function getRedisClient(): Redis | null {
    try {
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            return Redis.fromEnv();
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Check AI rate limit for a user/operation
 *
 * @param userId - User making the request
 * @param operation - Type of AI operation
 * @returns Rate limit check result
 */
export async function checkAIRateLimit(
    userId: string,
    operation: AIOperationType
): Promise<AIRateLimitResult> {
    const config = RATE_LIMIT_CONFIGS[operation];
    const key = `${config.prefix}:${userId}`;

    const redis = getRedisClient();
    if (!redis) {
        // Fall back to in-memory rate limiting
        return inMemoryLimiter.check(key, config.limit, config.window * 1000);
    }

    try {
        const ratelimit = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(config.limit, `${config.window} s`),
            analytics: true,
            prefix: config.prefix,
        });

        const result = await ratelimit.limit(userId);

        return {
            success: result.success,
            remaining: result.remaining,
            limit: result.limit,
            resetInSeconds: Math.ceil((result.reset - Date.now()) / 1000),
            error: result.success ? undefined : 'Rate limit exceeded. Intente de nuevo en un momento.',
        };
    } catch (error) {
        console.error('[AI Rate Limiter] Redis error, using in-memory fallback:', error);
        return inMemoryLimiter.check(key, config.limit, config.window * 1000);
    }
}

/**
 * Check organization daily AI usage limit
 *
 * @param organizationId - Organization ID
 * @param subscriptionTier - Organization's subscription tier
 * @returns Rate limit check result
 */
export async function checkOrgDailyLimit(
    organizationId: string,
    subscriptionTier: string = 'default'
): Promise<AIRateLimitResult> {
    const limit = ORG_DAILY_LIMITS[subscriptionTier] || ORG_DAILY_LIMITS.default;
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours
    const key = `ai:org:daily:${organizationId}`;

    const redis = getRedisClient();
    if (!redis) {
        return inMemoryLimiter.check(key, limit, windowMs);
    }

    try {
        const ratelimit = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(limit, '24 h'),
            analytics: true,
            prefix: 'ai:org:daily',
        });

        const result = await ratelimit.limit(organizationId);

        return {
            success: result.success,
            remaining: result.remaining,
            limit: result.limit,
            resetInSeconds: Math.ceil((result.reset - Date.now()) / 1000),
            error: result.success
                ? undefined
                : 'Límite diario de AI alcanzado. Actualice su plan para más capacidad.',
        };
    } catch (error) {
        console.error('[AI Rate Limiter] Org limit check failed:', error);
        return inMemoryLimiter.check(key, limit, windowMs);
    }
}

/**
 * Combined rate limit check for AI requests
 * Checks both user and organization limits
 *
 * @param userId - User making the request
 * @param organizationId - Organization ID
 * @param operation - Type of AI operation
 * @param subscriptionTier - Organization's subscription tier
 * @returns Combined rate limit result
 */
export async function checkCombinedAILimits(
    userId: string,
    organizationId: string,
    operation: AIOperationType,
    subscriptionTier?: string
): Promise<AIRateLimitResult> {
    // Check user rate limit first
    const userLimit = await checkAIRateLimit(userId, operation);
    if (!userLimit.success) {
        return userLimit;
    }

    // Then check organization daily limit
    const orgLimit = await checkOrgDailyLimit(organizationId, subscriptionTier);
    if (!orgLimit.success) {
        return orgLimit;
    }

    // Return the more restrictive remaining count
    return userLimit.remaining < orgLimit.remaining ? userLimit : orgLimit;
}

/**
 * Helper to format rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: AIRateLimitResult): Record<string, string> {
    return {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetInSeconds.toString(),
    };
}

const aiRateLimiter = {
    checkAIRateLimit,
    checkOrgDailyLimit,
    checkCombinedAILimits,
    getRateLimitHeaders,
};

export default aiRateLimiter;
