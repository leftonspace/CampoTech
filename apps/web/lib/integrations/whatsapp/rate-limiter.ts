/**
 * WhatsApp Rate Limiter
 * =====================
 *
 * Token bucket rate limiter for WhatsApp Business API.
 * Meta limits: 80 messages/second for Business API.
 *
 * Uses token bucket algorithm for smooth rate limiting with burst support.
 */

import {
  RateLimiterConfig,
  RateLimiterState,
  RateLimitResult,
  DEFAULT_RATE_LIMITER_CONFIG,
} from './types';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RATE LIMITER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export class WhatsAppRateLimiter {
  private config: RateLimiterConfig;
  private state: RateLimiterState;
  private queue: Array<{
    resolve: (result: RateLimitResult) => void;
    enqueuedAt: number;
  }> = [];
  private processingQueue = false;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMITER_CONFIG, ...config };
    this.state = {
      tokens: this.config.messagesPerSecond,
      lastRefill: Date.now(),
      queuedCount: 0,
      sentThisSecond: 0,
      currentSecond: Math.floor(Date.now() / 1000),
    };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // TOKEN BUCKET OPERATIONS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.state.lastRefill;
    const tokensToAdd = (elapsed / this.config.windowMs) * this.config.messagesPerSecond;

    this.state.tokens = Math.min(
      this.config.burstSize,
      this.state.tokens + tokensToAdd
    );
    this.state.lastRefill = now;

    // Reset per-second counter if second changed
    const currentSecond = Math.floor(now / 1000);
    if (currentSecond !== this.state.currentSecond) {
      this.state.sentThisSecond = 0;
      this.state.currentSecond = currentSecond;
    }
  }

  /**
   * Try to acquire a token for sending
   */
  private tryAcquire(): boolean {
    this.refillTokens();

    if (this.state.tokens >= 1 && this.state.sentThisSecond < this.config.messagesPerSecond) {
      this.state.tokens -= 1;
      this.state.sentThisSecond += 1;
      return true;
    }

    return false;
  }

  /**
   * Calculate wait time until next available slot
   */
  private calculateWaitTime(): number {
    const now = Date.now();
    const _currentSecond = Math.floor(now / 1000);
    const msIntoSecond = now % 1000;

    // If we've hit the per-second limit, wait for next second
    if (this.state.sentThisSecond >= this.config.messagesPerSecond) {
      return 1000 - msIntoSecond + 10; // Wait until next second + small buffer
    }

    // Otherwise, calculate based on token refill rate
    const tokensNeeded = 1 - this.state.tokens;
    if (tokensNeeded <= 0) return 0;

    const refillRate = this.config.messagesPerSecond / this.config.windowMs;
    return Math.ceil(tokensNeeded / refillRate);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PUBLIC API
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Request permission to send a message
   * Returns immediately if allowed, or queues the request
   */
  async acquire(): Promise<RateLimitResult> {
    // Try immediate acquisition
    if (this.tryAcquire()) {
      return {
        allowed: true,
        remainingCapacity: Math.floor(this.state.tokens),
      };
    }

    // If not queueing, return wait time
    if (!this.config.queueExcess) {
      return {
        allowed: false,
        waitTimeMs: this.calculateWaitTime(),
        remainingCapacity: 0,
      };
    }

    // Queue the request
    return new Promise((resolve) => {
      this.queue.push({ resolve, enqueuedAt: Date.now() });
      this.state.queuedCount = this.queue.length;
      this.processQueue();
    });
  }

  /**
   * Check if a message can be sent without waiting
   */
  canSendNow(): boolean {
    this.refillTokens();
    return this.state.tokens >= 1 && this.state.sentThisSecond < this.config.messagesPerSecond;
  }

  /**
   * Get current rate limiter status
   */
  getStatus(): {
    tokens: number;
    queuedCount: number;
    sentThisSecond: number;
    maxPerSecond: number;
    waitTimeMs: number;
  } {
    this.refillTokens();
    return {
      tokens: Math.floor(this.state.tokens),
      queuedCount: this.queue.length,
      sentThisSecond: this.state.sentThisSecond,
      maxPerSecond: this.config.messagesPerSecond,
      waitTimeMs: this.calculateWaitTime(),
    };
  }

  /**
   * Get remaining capacity this second
   */
  getRemainingCapacity(): number {
    this.refillTokens();
    return Math.max(0, this.config.messagesPerSecond - this.state.sentThisSecond);
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.state = {
      tokens: this.config.messagesPerSecond,
      lastRefill: Date.now(),
      queuedCount: 0,
      sentThisSecond: 0,
      currentSecond: Math.floor(Date.now() / 1000),
    };

    // Reject all queued requests
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        request.resolve({
          allowed: false,
          waitTimeMs: 0,
          remainingCapacity: this.config.messagesPerSecond,
        });
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // QUEUE PROCESSING
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.queue.length === 0) return;
    this.processingQueue = true;

    while (this.queue.length > 0) {
      if (this.tryAcquire()) {
        const request = this.queue.shift();
        if (request) {
          this.state.queuedCount = this.queue.length;
          request.resolve({
            allowed: true,
            queuePosition: 0,
            remainingCapacity: Math.floor(this.state.tokens),
          });
        }
      } else {
        // Wait and try again
        const waitTime = this.calculateWaitTime();
        await new Promise((resolve) => setTimeout(resolve, Math.max(10, waitTime)));
      }
    }

    this.processingQueue = false;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PER-ORGANIZATION RATE LIMITER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Rate limiter that also tracks per-organization limits
 * Useful for fair queueing across organizations
 */
export class OrganizationRateLimiter {
  private globalLimiter: WhatsAppRateLimiter;
  private orgLimiters: Map<string, { count: number; windowStart: number }> = new Map();
  private orgLimitPerMinute: number;

  constructor(
    globalConfig: Partial<RateLimiterConfig> = {},
    orgLimitPerMinute: number = 50
  ) {
    this.globalLimiter = new WhatsAppRateLimiter(globalConfig);
    this.orgLimitPerMinute = orgLimitPerMinute;
  }

  /**
   * Check if organization has capacity
   */
  checkOrgLimit(organizationId: string): boolean {
    const now = Date.now();
    let state = this.orgLimiters.get(organizationId);

    if (!state || now - state.windowStart >= 60000) {
      state = { count: 0, windowStart: now };
      this.orgLimiters.set(organizationId, state);
    }

    return state.count < this.orgLimitPerMinute;
  }

  /**
   * Acquire permission to send (checks both global and org limits)
   */
  async acquire(organizationId: string): Promise<RateLimitResult & { orgLimited?: boolean }> {
    // Check org limit first
    if (!this.checkOrgLimit(organizationId)) {
      const state = this.orgLimiters.get(organizationId)!;
      const waitTime = 60000 - (Date.now() - state.windowStart);
      return {
        allowed: false,
        waitTimeMs: waitTime,
        remainingCapacity: 0,
        orgLimited: true,
      };
    }

    // Check global limit
    const result = await this.globalLimiter.acquire();

    if (result.allowed) {
      // Increment org counter
      const state = this.orgLimiters.get(organizationId);
      if (state) {
        state.count++;
      }
    }

    return result;
  }

  /**
   * Get status for an organization
   */
  getOrgStatus(organizationId: string): {
    orgCount: number;
    orgLimit: number;
    orgWaitTime: number;
    global: ReturnType<WhatsAppRateLimiter['getStatus']>;
  } {
    const now = Date.now();
    const state = this.orgLimiters.get(organizationId);

    let orgCount = 0;
    let orgWaitTime = 0;

    if (state) {
      if (now - state.windowStart >= 60000) {
        orgCount = 0;
      } else {
        orgCount = state.count;
        if (orgCount >= this.orgLimitPerMinute) {
          orgWaitTime = 60000 - (now - state.windowStart);
        }
      }
    }

    return {
      orgCount,
      orgLimit: this.orgLimitPerMinute,
      orgWaitTime,
      global: this.globalLimiter.getStatus(),
    };
  }

  /**
   * Get global rate limiter status
   */
  getGlobalStatus(): ReturnType<WhatsAppRateLimiter['getStatus']> {
    return this.globalLimiter.getStatus();
  }

  /**
   * Reset all limiters
   */
  reset(): void {
    this.globalLimiter.reset();
    this.orgLimiters.clear();
  }

  /**
   * Clean up stale org entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [orgId, state] of this.orgLimiters) {
      if (now - state.windowStart >= 60000) {
        this.orgLimiters.delete(orgId);
      }
    }
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SINGLETON
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let globalRateLimiter: WhatsAppRateLimiter | null = null;
let orgRateLimiter: OrganizationRateLimiter | null = null;

export function getWARateLimiter(): WhatsAppRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new WhatsAppRateLimiter();
  }
  return globalRateLimiter;
}

export function getOrgRateLimiter(): OrganizationRateLimiter {
  if (!orgRateLimiter) {
    orgRateLimiter = new OrganizationRateLimiter();
  }
  return orgRateLimiter;
}

export function resetRateLimiters(): void {
  globalRateLimiter?.reset();
  orgRateLimiter?.reset();
  globalRateLimiter = null;
  orgRateLimiter = null;
}
