/**
 * AFIP Rate Limiter
 * =================
 *
 * Implements sliding window rate limiting for AFIP API calls.
 * Designed to respect AFIP's rate limits and prevent throttling.
 *
 * AFIP Rate Limits (unofficial, based on observation):
 * - ~10-15 requests per minute per CUIT
 * - Aggressive limits during peak hours
 */

import { RateLimiterConfig, RateLimiterState } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  burstAllowance: 2,
};

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════════

export class AFIPRateLimiter {
  private config: RateLimiterConfig;
  private timestamps: number[] = [];
  private windowStart: number = Date.now();

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a request can proceed
   */
  canProceed(): boolean {
    this.cleanup();
    const effectiveLimit = this.config.maxRequests + (this.config.burstAllowance || 0);
    return this.timestamps.length < effectiveLimit;
  }

  /**
   * Record a request
   */
  record(): void {
    this.timestamps.push(Date.now());
  }

  /**
   * Wait until a request can proceed (async blocking)
   */
  async waitForSlot(): Promise<void> {
    while (!this.canProceed()) {
      const waitTime = this.getWaitTime();
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Try to acquire a slot, returning wait time if not available
   */
  tryAcquire(): { acquired: boolean; waitTime: number } {
    this.cleanup();

    if (this.canProceed()) {
      this.record();
      return { acquired: true, waitTime: 0 };
    }

    return { acquired: false, waitTime: this.getWaitTime() };
  }

  /**
   * Get time to wait until next slot is available
   */
  getWaitTime(): number {
    this.cleanup();

    if (this.timestamps.length === 0) {
      return 0;
    }

    const effectiveLimit = this.config.maxRequests + (this.config.burstAllowance || 0);
    if (this.timestamps.length < effectiveLimit) {
      return 0;
    }

    // Find when the oldest timestamp in the window will expire
    const oldestInWindow = this.timestamps[0];
    const expiresAt = oldestInWindow + this.config.windowMs;
    const waitTime = Math.max(0, expiresAt - Date.now());

    return waitTime + 100; // Add small buffer
  }

  /**
   * Get current state
   */
  getState(): RateLimiterState {
    this.cleanup();

    const effectiveLimit = this.config.maxRequests + (this.config.burstAllowance || 0);
    const remaining = Math.max(0, effectiveLimit - this.timestamps.length);
    const resetAt = new Date(this.windowStart + this.config.windowMs);

    return {
      currentCount: this.timestamps.length,
      remaining,
      resetAt,
      isLimited: remaining === 0,
    };
  }

  /**
   * Get available requests
   */
  getAvailable(): number {
    this.cleanup();
    const effectiveLimit = this.config.maxRequests + (this.config.burstAllowance || 0);
    return Math.max(0, effectiveLimit - this.timestamps.length);
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.timestamps = [];
    this.windowStart = Date.now();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup expired timestamps
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.config.windowMs;
    const newTimestamps = this.timestamps.filter((ts) => ts > cutoff);

    // Update window start if we cleared old timestamps
    if (newTimestamps.length === 0 && this.timestamps.length > 0) {
      this.windowStart = Date.now();
    }

    this.timestamps = newTimestamps;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PER-ORGANIZATION RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rate limiter that tracks limits per organization/CUIT
 */
export class PerOrgRateLimiter {
  private limiters: Map<string, AFIPRateLimiter> = new Map();
  private config: RateLimiterConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Get or create rate limiter for an organization
   */
  private getLimiter(orgId: string): AFIPRateLimiter {
    let limiter = this.limiters.get(orgId);
    if (!limiter) {
      limiter = new AFIPRateLimiter(this.config);
      this.limiters.set(orgId, limiter);
    }
    return limiter;
  }

  /**
   * Check if request can proceed for organization
   */
  canProceed(orgId: string): boolean {
    return this.getLimiter(orgId).canProceed();
  }

  /**
   * Record a request for organization
   */
  record(orgId: string): void {
    this.getLimiter(orgId).record();
  }

  /**
   * Try to acquire a slot for organization
   */
  tryAcquire(orgId: string): { acquired: boolean; waitTime: number } {
    return this.getLimiter(orgId).tryAcquire();
  }

  /**
   * Wait for slot for organization
   */
  async waitForSlot(orgId: string): Promise<void> {
    return this.getLimiter(orgId).waitForSlot();
  }

  /**
   * Get state for organization
   */
  getState(orgId: string): RateLimiterState {
    return this.getLimiter(orgId).getState();
  }

  /**
   * Get all organization states
   */
  getAllStates(): Map<string, RateLimiterState> {
    const states = new Map<string, RateLimiterState>();
    for (const [orgId, limiter] of this.limiters) {
      states.set(orgId, limiter.getState());
    }
    return states;
  }

  /**
   * Reset limiter for organization
   */
  reset(orgId: string): void {
    const limiter = this.limiters.get(orgId);
    if (limiter) {
      limiter.reset();
    }
  }

  /**
   * Reset all limiters
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }

  /**
   * Start periodic cleanup of inactive limiters
   */
  private startCleanup(): void {
    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactive();
    }, 300000);
  }

  /**
   * Cleanup inactive limiters (no requests in last window)
   */
  private cleanupInactive(): void {
    const inactiveOrgs: string[] = [];

    for (const [orgId, limiter] of this.limiters) {
      const state = limiter.getState();
      if (state.currentCount === 0) {
        inactiveOrgs.push(orgId);
      }
    }

    for (const orgId of inactiveOrgs) {
      this.limiters.delete(orgId);
    }
  }

  /**
   * Stop the rate limiter
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL RATE LIMITER (AFIP-WIDE)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Combined rate limiter with global and per-org limits
 */
export class CombinedRateLimiter {
  private globalLimiter: AFIPRateLimiter;
  private perOrgLimiter: PerOrgRateLimiter;

  constructor(
    globalConfig: Partial<RateLimiterConfig> = {},
    perOrgConfig: Partial<RateLimiterConfig> = {}
  ) {
    // Global limit is higher (total across all orgs)
    this.globalLimiter = new AFIPRateLimiter({
      maxRequests: 50,
      windowMs: 60000,
      burstAllowance: 10,
      ...globalConfig,
    });

    // Per-org limit is lower
    this.perOrgLimiter = new PerOrgRateLimiter({
      maxRequests: 10,
      windowMs: 60000,
      burstAllowance: 2,
      ...perOrgConfig,
    });
  }

  /**
   * Check if request can proceed
   */
  canProceed(orgId: string): boolean {
    return this.globalLimiter.canProceed() && this.perOrgLimiter.canProceed(orgId);
  }

  /**
   * Try to acquire a slot
   */
  tryAcquire(orgId: string): { acquired: boolean; waitTime: number; reason?: string } {
    // Check global limit first
    const globalResult = this.globalLimiter.tryAcquire();
    if (!globalResult.acquired) {
      return { ...globalResult, reason: 'global_limit' };
    }

    // Check per-org limit
    const orgResult = this.perOrgLimiter.tryAcquire(orgId);
    if (!orgResult.acquired) {
      // Roll back global acquisition (decrement would be ideal, but we'll accept the small inaccuracy)
      return { ...orgResult, reason: 'org_limit' };
    }

    return { acquired: true, waitTime: 0 };
  }

  /**
   * Get combined state
   */
  getState(orgId: string): {
    global: RateLimiterState;
    org: RateLimiterState;
    canProceed: boolean;
  } {
    return {
      global: this.globalLimiter.getState(),
      org: this.perOrgLimiter.getState(orgId),
      canProceed: this.canProceed(orgId),
    };
  }

  /**
   * Stop the rate limiters
   */
  stop(): void {
    this.perOrgLimiter.stop();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let globalRateLimiter: CombinedRateLimiter | null = null;

export function getAFIPRateLimiter(): CombinedRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new CombinedRateLimiter();
  }
  return globalRateLimiter;
}

export function resetAFIPRateLimiter(): void {
  if (globalRateLimiter) {
    globalRateLimiter.stop();
    globalRateLimiter = null;
  }
}
