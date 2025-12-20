/**
 * AFIP Circuit Breaker
 * ====================
 *
 * Implements circuit breaker pattern for AFIP API calls.
 * Prevents cascading failures when AFIP is unavailable.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: AFIP is failing, requests are rejected immediately
 * - HALF-OPEN: Testing if AFIP has recovered
 *
 * Based on:
 * - src/workers/afip/afip-retry.strategy.ts (core implementation)
 * - Adapted for web app use with Redis persistence option
 */

import {
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  CircuitState,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  openDuration: 300000, // 5 minutes
  halfOpenProbes: 1,
  failureWindow: 60000, // 1 minute - failures outside this window don't count
};

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

export class AFIPCircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private openedAt: Date | null = null;
  private halfOpenProbeCount: number = 0;
  private failureTimestamps: number[] = [];

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if requests are allowed
   */
  canRequest(): boolean {
    this.updateState();
    return this.state !== 'open';
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canRequest()) {
      throw new CircuitBreakerOpenError(
        'Circuit breaker is open',
        this.getNextRetryTime()
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.successes++;
    this.lastSuccess = new Date();

    if (this.state === 'half-open') {
      // Success in half-open means we can close the circuit
      this.close();
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    const now = Date.now();
    this.failures++;
    this.lastFailure = new Date();
    this.failureTimestamps.push(now);

    // Cleanup old failures outside the window
    this.cleanupFailures();

    // Check if we should open the circuit
    if (this.state === 'closed' || this.state === 'half-open') {
      if (this.failureTimestamps.length >= this.config.failureThreshold) {
        this.open();
      }
    }
  }

  /**
   * Get current status
   */
  getStatus(): CircuitBreakerStatus {
    this.updateState();

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
      nextRetryAt: this.getNextRetryTime(),
    };
  }

  /**
   * Force the circuit to open
   */
  forceOpen(reason?: string): void {
    this.open();
    console.warn('[AFIP CircuitBreaker] Force opened:', reason || 'manual');
  }

  /**
   * Force the circuit to close
   */
  forceClose(): void {
    this.close();
    console.info('[AFIP CircuitBreaker] Force closed');
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.openedAt = null;
    this.halfOpenProbeCount = 0;
    this.failureTimestamps = [];
    console.info('[AFIP CircuitBreaker] Reset');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private open(): void {
    if (this.state === 'open') return;

    this.state = 'open';
    this.openedAt = new Date();
    this.halfOpenProbeCount = 0;

    console.error('[AFIP CircuitBreaker] OPENED', {
      failures: this.failures,
      recentFailures: this.failureTimestamps.length,
      threshold: this.config.failureThreshold,
      nextRetry: this.getNextRetryTime(),
    });
  }

  private close(): void {
    if (this.state === 'closed') return;

    const wasOpen = this.state === 'open';
    const duration = this.openedAt
      ? Date.now() - this.openedAt.getTime()
      : 0;

    this.state = 'closed';
    this.openedAt = null;
    this.halfOpenProbeCount = 0;
    this.failureTimestamps = [];

    console.info('[AFIP CircuitBreaker] CLOSED', {
      wasOpen,
      openDuration: wasOpen ? `${Math.round(duration / 1000)}s` : 'N/A',
    });
  }

  private updateState(): void {
    if (this.state === 'open' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt.getTime();

      if (elapsed >= this.config.openDuration) {
        this.state = 'half-open';
        this.halfOpenProbeCount = 0;
        console.info('[AFIP CircuitBreaker] Transitioning to half-open');
      }
    }
  }

  private cleanupFailures(): void {
    if (!this.config.failureWindow) return;

    const cutoff = Date.now() - this.config.failureWindow;
    this.failureTimestamps = this.failureTimestamps.filter((ts) => ts > cutoff);
  }

  private getNextRetryTime(): Date | null {
    if (this.state !== 'open' || !this.openedAt) {
      return null;
    }

    return new Date(this.openedAt.getTime() + this.config.openDuration);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER ERROR
// ═══════════════════════════════════════════════════════════════════════════════

export class CircuitBreakerOpenError extends Error {
  readonly nextRetryAt: Date | null;
  readonly code = 'CIRCUIT_BREAKER_OPEN';

  constructor(message: string, nextRetryAt: Date | null) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
    this.nextRetryAt = nextRetryAt;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PER-ORGANIZATION CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Circuit breaker that tracks state per organization
 * Useful when one org's AFIP config might be broken without affecting others
 */
export class PerOrgCircuitBreaker {
  private breakers: Map<string, AFIPCircuitBreaker> = new Map();
  private globalBreaker: AFIPCircuitBreaker;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Global breaker has higher threshold
    this.globalBreaker = new AFIPCircuitBreaker({
      ...this.config,
      failureThreshold: this.config.failureThreshold * 3,
    });
  }

  /**
   * Get or create circuit breaker for an organization
   */
  private getBreaker(orgId: string): AFIPCircuitBreaker {
    let breaker = this.breakers.get(orgId);
    if (!breaker) {
      breaker = new AFIPCircuitBreaker(this.config);
      this.breakers.set(orgId, breaker);
    }
    return breaker;
  }

  /**
   * Check if request can proceed for organization
   */
  canRequest(orgId: string): boolean {
    // Both global and per-org must allow
    return this.globalBreaker.canRequest() && this.getBreaker(orgId).canRequest();
  }

  /**
   * Execute with circuit breaker protection
   */
  async execute<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
    if (!this.globalBreaker.canRequest()) {
      throw new CircuitBreakerOpenError(
        'Global circuit breaker is open',
        this.globalBreaker.getStatus().nextRetryAt
      );
    }

    const breaker = this.getBreaker(orgId);
    if (!breaker.canRequest()) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker for org ${orgId} is open`,
        breaker.getStatus().nextRetryAt
      );
    }

    try {
      const result = await fn();
      breaker.recordSuccess();
      this.globalBreaker.recordSuccess();
      return result;
    } catch (error) {
      breaker.recordFailure();
      this.globalBreaker.recordFailure();
      throw error;
    }
  }

  /**
   * Record success for organization
   */
  recordSuccess(orgId: string): void {
    this.getBreaker(orgId).recordSuccess();
    this.globalBreaker.recordSuccess();
  }

  /**
   * Record failure for organization
   */
  recordFailure(orgId: string): void {
    this.getBreaker(orgId).recordFailure();
    this.globalBreaker.recordFailure();
  }

  /**
   * Get status for organization
   */
  getStatus(orgId: string): {
    global: CircuitBreakerStatus;
    org: CircuitBreakerStatus;
    canRequest: boolean;
  } {
    return {
      global: this.globalBreaker.getStatus(),
      org: this.getBreaker(orgId).getStatus(),
      canRequest: this.canRequest(orgId),
    };
  }

  /**
   * Get all organization statuses
   */
  getAllStatuses(): Map<string, CircuitBreakerStatus> {
    const statuses = new Map<string, CircuitBreakerStatus>();
    for (const [orgId, breaker] of this.breakers) {
      statuses.set(orgId, breaker.getStatus());
    }
    return statuses;
  }

  /**
   * Get global status
   */
  getGlobalStatus(): CircuitBreakerStatus {
    return this.globalBreaker.getStatus();
  }

  /**
   * Reset breaker for organization
   */
  reset(orgId: string): void {
    const breaker = this.breakers.get(orgId);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    this.globalBreaker.reset();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let globalCircuitBreaker: PerOrgCircuitBreaker | null = null;

export function getAFIPCircuitBreaker(): PerOrgCircuitBreaker {
  if (!globalCircuitBreaker) {
    globalCircuitBreaker = new PerOrgCircuitBreaker();
  }
  return globalCircuitBreaker;
}

export function resetAFIPCircuitBreaker(): void {
  if (globalCircuitBreaker) {
    globalCircuitBreaker.resetAll();
    globalCircuitBreaker = null;
  }
}
