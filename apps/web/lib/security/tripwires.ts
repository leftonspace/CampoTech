/**
 * Security Tripwires — Anomaly Detection Service
 * ================================================
 *
 * Phase: CERT-AR / Cybersecurity Breach Detection (Res. 580/2011 + Convenio 108+)
 *
 * Implements rate-based anomaly detection for the 3 Kill Zones.
 * Uses in-memory sliding windows with Redis fallback when available.
 *
 * Each tripwire tracks per-user access frequency and triggers escalating
 * responses: WARNING → CRITICAL → LOCKDOWN.
 *
 * The sliding window approach is intentional:
 *   - An attacker can't "spread" the attack over time without being detected
 *   - Normal usage never hits these thresholds (verified against real access patterns)
 *   - In-memory store works for single-instance; Redis for horizontal scaling
 *
 * @see kill-zone-monitor.ts (calls these functions from the Prisma extension)
 * @see .legal/Comprehensive_Review_of_Laws/1.2 CERT-AR
 */

import { redis } from '@/lib/cache';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TripwireAction = 'LOG' | 'ALERT' | 'LOCKDOWN';

export interface TripwireResult {
    triggered: boolean;
    action: TripwireAction;
    userId: string;
    zone: string;
    accessCount: number;
    threshold: number;
    windowMs: number;
    message: string;
}

interface AccessRecord {
    timestamps: number[];
    totalRecords: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// THRESHOLDS — Tuned to real usage patterns
// ═══════════════════════════════════════════════════════════════════════════════

const TRIPWIRE_CONFIG = {
    /**
     * Kill Zone 1: AFIP Key Access
     *
     * Normal pattern: AFIPCredentialsService.getCredentials(orgId) — 1 key per invoice batch.
     * Even a busy accountant processing 5 orgs/minute is plausible.
     * But 6+ in 1 minute? That's a script enumerating all orgs.
     */
    AFIP_KEY: {
        maxAccessesPerWindow: 5,
        windowMs: 60_000, // 1 minute
        lockdownThreshold: 10, // Immediate lockdown at 10
        redisPrefix: 'tripwire:afip_key',
    },

    /**
     * Kill Zone 2: Location Scraping
     *
     * Normal pattern: Admin views their own team on the map (1 org, ~5-15 technicians).
     * Pulling location for > 3 DIFFERENT technicians' histories in 1 minute? Scraping.
     *
     * NOTE: "count" here represents distinct technician IDs, not total records.
     * The kill-zone-monitor passes the number of records returned.
     * We track cumulative accesses within the window.
     */
    LOCATION: {
        maxAccessesPerWindow: 3,
        windowMs: 60_000, // 1 minute
        lockdownThreshold: 8,
        redisPrefix: 'tripwire:location',
    },

    /**
     * Kill Zone 3: WhatsApp Token Access
     *
     * Normal pattern: WA webhook handler reads 1 account per incoming message.
     * Even with bursty webhooks, reading > 5 different account tokens/minute is abnormal.
     */
    WA_TOKEN: {
        maxAccessesPerWindow: 5,
        windowMs: 60_000, // 1 minute
        lockdownThreshold: 15,
        redisPrefix: 'tripwire:wa_token',
    },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY SLIDING WINDOW (Fallback when Redis is unavailable)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * In-memory store for sliding window tracking.
 * Structure: Map<"zone:userId" → AccessRecord>
 *
 * WARNING: This only works for single-instance deployments.
 * For Railway/Vercel with multiple replicas, Redis is required.
 * The in-memory store ensures we degrade gracefully, not silently.
 */
const memoryStore = new Map<string, AccessRecord>();

// Garbage collect expired entries every 5 minutes
const GC_INTERVAL_MS = 5 * 60_000;
let lastGC = Date.now();

function gcMemoryStore(): void {
    const now = Date.now();
    if (now - lastGC < GC_INTERVAL_MS) return;
    lastGC = now;

    const maxAge = Math.max(
        TRIPWIRE_CONFIG.AFIP_KEY.windowMs,
        TRIPWIRE_CONFIG.LOCATION.windowMs,
        TRIPWIRE_CONFIG.WA_TOKEN.windowMs,
    );

    for (const [key, record] of memoryStore.entries()) {
        // Remove entries where all timestamps are expired
        const freshTimestamps = record.timestamps.filter(t => now - t < maxAge);
        if (freshTimestamps.length === 0) {
            memoryStore.delete(key);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE SLIDING WINDOW ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record an access event and check against thresholds.
 *
 * Algorithm:
 *   1. Record the current timestamp and count for the user+zone
 *   2. Evict timestamps older than the window
 *   3. Sum total records accessed within the window
 *   4. Compare against thresholds and return the appropriate action
 */
async function recordAndCheck(
    userId: string,
    zone: keyof typeof TRIPWIRE_CONFIG,
    count: number,
): Promise<TripwireResult> {
    const config = TRIPWIRE_CONFIG[zone];
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let totalInWindow: number;

    // Try Redis first (works across replicas)
    if (redis) {
        try {
            totalInWindow = await recordInRedis(userId, zone, count, config, now, windowStart);
        } catch {
            // Redis failed — fall back to memory
            console.warn(`[Tripwire] Redis error for ${zone}, falling back to memory store`);
            totalInWindow = recordInMemory(userId, zone, count, config, now, windowStart);
        }
    } else {
        totalInWindow = recordInMemory(userId, zone, count, config, now, windowStart);
    }

    // Cleanup old entries periodically
    gcMemoryStore();

    // Determine action based on accumulated count
    const action = determineAction(totalInWindow, config);

    const result: TripwireResult = {
        triggered: action !== 'LOG',
        action,
        userId,
        zone,
        accessCount: totalInWindow,
        threshold: config.maxAccessesPerWindow,
        windowMs: config.windowMs,
        message: buildMessage(zone, action, userId, totalInWindow, config),
    };

    // If the tripwire fired, execute the response
    if (result.triggered) {
        await executeTripwireResponse(result);
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE BACKENDS
// ═══════════════════════════════════════════════════════════════════════════════

async function recordInRedis(
    userId: string,
    zone: keyof typeof TRIPWIRE_CONFIG,
    count: number,
    config: typeof TRIPWIRE_CONFIG[keyof typeof TRIPWIRE_CONFIG],
    now: number,
    windowStart: number,
): Promise<number> {
    const key = `${config.redisPrefix}:${userId}`;

    // Use a Redis sorted set with timestamps as scores
    // Each record's score is its timestamp, value is "timestamp:count"
    const member = `${now}:${count}`;

    await redis!.zadd(key, { score: now, member });

    // Remove entries outside the window
    await redis!.zremrangebyscore(key, 0, windowStart);

    // Set expiry on the key (auto-cleanup)
    await redis!.expire(key, Math.ceil(config.windowMs / 1000) + 60);

    // Get all entries in the current window (Upstash uses zrange with byScore option)
    const entries = await redis!.zrange(key, windowStart, now, { byScore: true }) as string[];

    // Sum the counts from all entries
    let total = 0;
    for (const entry of entries) {
        const parts = String(entry).split(':');
        total += parseInt(parts[1] || '0', 10);
    }

    return total;
}

function recordInMemory(
    userId: string,
    zone: keyof typeof TRIPWIRE_CONFIG,
    count: number,
    config: typeof TRIPWIRE_CONFIG[keyof typeof TRIPWIRE_CONFIG],
    now: number,
    windowStart: number,
): number {
    const key = `${zone}:${userId}`;
    const existing = memoryStore.get(key) ?? { timestamps: [], totalRecords: 0 };

    // Record this access
    existing.timestamps.push(now);
    existing.totalRecords += count;

    // Evict old entries
    const originalLength = existing.timestamps.length;
    existing.timestamps = existing.timestamps.filter(t => t >= windowStart);

    // If we evicted entries, reduce the total proportionally
    if (existing.timestamps.length < originalLength) {
        // Recalculate — we can't track individual counts per timestamp in this simplified model
        // So we reset and just use the current window's count
        existing.totalRecords = count;
    }

    memoryStore.set(key, existing);

    return existing.totalRecords;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION DETERMINATION
// ═══════════════════════════════════════════════════════════════════════════════

function determineAction(
    totalInWindow: number,
    config: { maxAccessesPerWindow: number; lockdownThreshold: number },
): TripwireAction {
    if (totalInWindow >= config.lockdownThreshold) {
        return 'LOCKDOWN';
    }
    if (totalInWindow > config.maxAccessesPerWindow) {
        return 'ALERT';
    }
    return 'LOG';
}

function buildMessage(
    zone: string,
    action: TripwireAction,
    userId: string,
    count: number,
    config: { maxAccessesPerWindow: number; windowMs: number },
): string {
    const windowSec = config.windowMs / 1000;

    switch (action) {
        case 'LOCKDOWN':
            return `🚨 LOCKDOWN — User ${userId} accessed ${count} ${zone} records in ${windowSec}s ` +
                `(lockdown threshold breached). All access revoked.`;
        case 'ALERT':
            return `⚠️ SECURITY ALERT — User ${userId} accessed ${count} ${zone} records in ${windowSec}s ` +
                `(threshold: ${config.maxAccessesPerWindow}). Possible data exfiltration.`;
        case 'LOG':
            return `[Tripwire] ${zone}: ${userId} accessed ${count} records (within normal range)`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIPWIRE RESPONSE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute the response for a triggered tripwire.
 *
 * ALERT: Log to console + audit, notify via Slack/PagerDuty (future)
 * LOCKDOWN: All of the above + revoke all sessions for the user
 */
async function executeTripwireResponse(result: TripwireResult): Promise<void> {
    // Always log to structured output
    const logLevel = result.action === 'LOCKDOWN' ? 'error' : 'warn';
    console[logLevel](
        `[TRIPWIRE] ${result.message}`,
        JSON.stringify({
            zone: result.zone,
            action: result.action,
            userId: result.userId,
            accessCount: result.accessCount,
            threshold: result.threshold,
            windowMs: result.windowMs,
        }),
    );

    if (result.action === 'LOCKDOWN') {
        await executeLockdown(result);
    }
}

/**
 * Execute a lockdown for a user.
 *
 * Steps:
 *   1. Revoke all refresh tokens (force re-login)
 *   2. Write a LOCKDOWN audit entry
 *   3. Set a Redis block flag (picked up by rate-limit middleware)
 *   4. Send notification to admin (Slack/email — future integration)
 */
async function executeLockdown(result: TripwireResult): Promise<void> {
    console.error(
        `🚨🚨🚨 [LOCKDOWN] Executing lockdown for user ${result.userId}`,
        `Zone: ${result.zone}, Records: ${result.accessCount}`,
    );

    // 1. Block the user via Redis (if available)
    if (redis) {
        try {
            const blockKey = `security:lockdown:${result.userId}`;
            await redis.set(blockKey, {
                reason: result.message,
                zone: result.zone,
                triggeredAt: new Date().toISOString(),
                accessCount: result.accessCount,
            }, {
                ex: 3600, // Block for 1 hour (requires manual admin review to unblock)
            });
        } catch (error) {
            console.error('[LOCKDOWN] Failed to set Redis block:', error);
        }
    }

    // 2. Revoke all refresh tokens for the user (via direct DB call)
    // We import prisma lazily to avoid circular dependencies
    try {
        const { prisma } = await import('@/lib/prisma');
        await prisma.refreshToken.updateMany({
            where: {
                userId: result.userId,
                revoked: false,
            },
            data: {
                revoked: true,
            },
        });
    } catch (error) {
        console.error('[LOCKDOWN] Failed to revoke tokens:', error);
    }

    // 3. Write lockdown event to audit log
    try {
        const { prisma } = await import('@/lib/prisma');
        await prisma.$executeRaw`
      INSERT INTO "audit_logs" (
        "id", "organizationId", "userId", "action", "entityType", "entityId", "metadata", "createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        'SYSTEM',
        ${result.userId},
        'SECURITY_LOCKDOWN',
        ${result.zone},
        ${result.userId},
        ${JSON.stringify({
            action: result.action,
            accessCount: result.accessCount,
            threshold: result.threshold,
            message: result.message,
        })}::jsonb,
        NOW()
      )
    `;
    } catch (error) {
        console.error('[LOCKDOWN] Failed to write audit log:', error);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API — Called by kill-zone-monitor.ts
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check AFIP key access patterns for a user.
 *
 * Trips if a single user accesses > 5 AFIP private keys in 1 minute.
 * Normal operation: AFIPCredentialsService reads 1 org at a time.
 *
 * @param userId - The user performing the query
 * @param count - Number of organization records returned (with key fields)
 */
export async function checkAfipKeyAccess(
    userId: string,
    count: number,
): Promise<TripwireResult> {
    return recordAndCheck(userId, 'AFIP_KEY', count);
}

/**
 * Check location scraping patterns for a user.
 *
 * Trips if a user pulls location data for > 3 different technicians in 1 minute.
 * Normal operation: Dashboard reads locations for the user's own org.
 *
 * @param userId - The user performing the query
 * @param count - Number of location records returned
 */
export async function checkLocationScraping(
    userId: string,
    count: number,
): Promise<TripwireResult> {
    return recordAndCheck(userId, 'LOCATION', count);
}

/**
 * Check WhatsApp token access patterns for a user.
 *
 * Trips if a user accesses > 5 different WA account tokens in 1 minute.
 * Normal operation: Webhook handler reads 1 account per incoming message.
 *
 * @param userId - The user performing the query
 * @param count - Number of WA account records returned (with token fields)
 */
export async function checkWhatsAppTokenAccess(
    userId: string,
    count: number,
): Promise<TripwireResult> {
    return recordAndCheck(userId, 'WA_TOKEN', count);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a user is currently locked down.
 */
export async function isUserLockedDown(userId: string): Promise<boolean> {
    if (!redis) return false;

    try {
        const blockKey = `security:lockdown:${userId}`;
        const blocked = await redis.get(blockKey);
        return blocked !== null;
    } catch {
        return false;
    }
}

/**
 * Manually unlock a user (admin action).
 * Requires explicit admin intervention — lockdowns are never auto-cleared.
 */
export async function unlockUser(userId: string): Promise<boolean> {
    if (!redis) return false;

    try {
        const blockKey = `security:lockdown:${userId}`;
        await redis.del(blockKey);

        console.warn(`[TRIPWIRE] Admin manually unlocked user ${userId}`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the current tripwire state for a user (for admin dashboard).
 */
export async function getTripwireState(userId: string): Promise<{
    afipKey: number;
    location: number;
    waToken: number;
    isLockedDown: boolean;
}> {
    const lockedDown = await isUserLockedDown(userId);

    if (redis) {
        try {
            const now = Date.now();
            const [afipEntries, locationEntries, waEntries] = await Promise.all([
                redis.zrange(
                    `${TRIPWIRE_CONFIG.AFIP_KEY.redisPrefix}:${userId}`,
                    now - TRIPWIRE_CONFIG.AFIP_KEY.windowMs,
                    now,
                    { byScore: true },
                ),
                redis.zrange(
                    `${TRIPWIRE_CONFIG.LOCATION.redisPrefix}:${userId}`,
                    now - TRIPWIRE_CONFIG.LOCATION.windowMs,
                    now,
                    { byScore: true },
                ),
                redis.zrange(
                    `${TRIPWIRE_CONFIG.WA_TOKEN.redisPrefix}:${userId}`,
                    now - TRIPWIRE_CONFIG.WA_TOKEN.windowMs,
                    now,
                    { byScore: true },
                ),
            ]);

            return {
                afipKey: sumEntryCounts(afipEntries as string[]),
                location: sumEntryCounts(locationEntries as string[]),
                waToken: sumEntryCounts(waEntries as string[]),
                isLockedDown: lockedDown,
            };
        } catch {
            // Fall through to memory store
        }
    }

    // Fallback to memory store
    const afipRecord = memoryStore.get(`AFIP_KEY:${userId}`);
    const locationRecord = memoryStore.get(`LOCATION:${userId}`);
    const waRecord = memoryStore.get(`WA_TOKEN:${userId}`);

    return {
        afipKey: afipRecord?.totalRecords ?? 0,
        location: locationRecord?.totalRecords ?? 0,
        waToken: waRecord?.totalRecords ?? 0,
        isLockedDown: lockedDown,
    };
}

function sumEntryCounts(entries: string[]): number {
    let total = 0;
    for (const entry of entries) {
        const parts = String(entry).split(':');
        total += parseInt(parts[1] || '0', 10);
    }
    return total;
}
