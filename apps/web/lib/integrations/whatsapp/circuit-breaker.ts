/**
 * WhatsApp Circuit Breaker
 * ========================
 *
 * Circuit breaker for WhatsApp API to prevent cascading failures.
 * Automatically opens when too many failures occur.
 */

import {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  DEFAULT_CIRCUIT_CONFIG,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

export class WACircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private halfOpenRequests: number = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private openedAt: Date | null = null;
  private config: CircuitBreakerConfig;
  private latencies: number[] = [];
  private maxLatencySamples = 100;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if request should be allowed
   */
  canRequest(): boolean {
    this.checkStateTransition();

    switch (this.state) {
      case 'closed':
        return true;

      case 'open':
        return false;

      case 'half-open':
        return this.halfOpenRequests < this.config.halfOpenRequests;

      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(latency?: number): void {
    this.lastSuccess = new Date();
    if (latency) this.recordLatency(latency);

    switch (this.state) {
      case 'closed':
        this.failures = 0;
        break;

      case 'half-open':
        this.successes++;
        this.halfOpenRequests++;

        if (this.successes >= this.config.successThreshold) {
          this.transitionTo('closed');
        }
        break;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(error?: Error | string): void {
    this.failures++;
    this.lastFailure = new Date();

    const errorMessage = error instanceof Error ? error.message : error;
    console.warn('[WA Circuit Breaker] Failure recorded:', {
      failures: this.failures,
      threshold: this.config.failureThreshold,
      state: this.state,
      error: errorMessage,
    });

    switch (this.state) {
      case 'closed':
        if (this.failures >= this.config.failureThreshold) {
          this.transitionTo('open');
        }
        break;

      case 'half-open':
        this.transitionTo('open');
        break;
    }
  }

  /**
   * Get current status
   */
  getStatus(): CircuitBreakerStatus {
    this.checkStateTransition();

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
   * Get current state
   */
  getState(): CircuitState {
    this.checkStateTransition();
    return this.state;
  }

  /**
   * Get average latency
   */
  getAverageLatency(): number {
    if (this.latencies.length === 0) return 0;
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencies.length);
  }

  /**
   * Get success rate (percentage)
   */
  getSuccessRate(): number {
    const total = this.successes + this.failures;
    if (total === 0) return 100;
    return Math.round((this.successes / total) * 100);
  }

  /**
   * Force circuit state (admin only)
   */
  forceState(state: CircuitState): void {
    console.warn(`[WA Circuit Breaker] Force transition to ${state}`);
    this.transitionTo(state);
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.halfOpenRequests = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.openedAt = null;
    this.latencies = [];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INTERNAL METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private checkStateTransition(): void {
    if (this.state === 'open' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt.getTime();
      if (elapsed >= this.config.openDurationMs) {
        this.transitionTo('half-open');
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;

    console.log(`[WA Circuit Breaker] ${previousState} → ${newState}`);

    switch (newState) {
      case 'closed':
        this.failures = 0;
        this.successes = 0;
        this.halfOpenRequests = 0;
        this.openedAt = null;
        break;

      case 'open':
        this.openedAt = new Date();
        this.successes = 0;
        this.halfOpenRequests = 0;
        break;

      case 'half-open':
        this.successes = 0;
        this.halfOpenRequests = 0;
        break;
    }
  }

  private getNextRetryTime(): Date | null {
    if (this.state !== 'open' || !this.openedAt) {
      return null;
    }
    return new Date(this.openedAt.getTime() + this.config.openDurationMs);
  }

  private recordLatency(latency: number): void {
    this.latencies.push(latency);
    if (this.latencies.length > this.maxLatencySamples) {
      this.latencies.shift();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

export type WAErrorType = 'transient' | 'permanent' | 'rate_limit' | 'authentication';

/**
 * Classify WhatsApp API error
 */
export function classifyWAError(error: unknown): WAErrorType {
  if (!error) return 'permanent';

  const err = error as { status?: number; code?: number | string; message?: string };

  // Rate limiting
  if (err.status === 429 || err.code === 429) {
    return 'rate_limit';
  }

  // Authentication errors
  if (err.status === 401 || err.status === 403) {
    return 'authentication';
  }
  if (err.code === 190 || err.code === '190') {
    return 'authentication'; // Invalid access token
  }

  // Server errors (transient)
  if (err.status && err.status >= 500) {
    return 'transient';
  }

  // WhatsApp-specific transient errors
  const transientCodes = [
    131000, // Something went wrong
    131005, // Access token expired
    131031, // Flow blocked
    131047, // Rate limit hit
    131048, // Spam rate limit
    131049, // Business phone limit
  ];

  if (err.code && transientCodes.includes(Number(err.code))) {
    return 'transient';
  }

  // Network errors
  if (err.message) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('enotfound') ||
      msg.includes('network')
    ) {
      return 'transient';
    }
  }

  return 'permanent';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const type = classifyWAError(error);
  return type === 'transient' || type === 'rate_limit';
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION WITH CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

export class CircuitOpenError extends Error {
  constructor(
    message: string,
    public readonly retryAt?: Date
  ) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Execute function with circuit breaker protection
 */
export async function executeWithCircuitBreaker<T>(
  circuitBreaker: WACircuitBreaker,
  fn: () => Promise<T>,
  options: {
    onCircuitOpen?: () => void;
  } = {}
): Promise<T> {
  if (!circuitBreaker.canRequest()) {
    const status = circuitBreaker.getStatus();
    options.onCircuitOpen?.();
    throw new CircuitOpenError(
      'Circuit breaker is open',
      status.nextRetryAt || undefined
    );
  }

  const startTime = Date.now();

  try {
    const result = await fn();
    circuitBreaker.recordSuccess(Date.now() - startTime);
    return result;
  } catch (error) {
    circuitBreaker.recordFailure(error instanceof Error ? error : undefined);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let circuitBreaker: WACircuitBreaker | null = null;

export function getWACircuitBreaker(): WACircuitBreaker {
  if (!circuitBreaker) {
    circuitBreaker = new WACircuitBreaker();
  }
  return circuitBreaker;
}

export function resetWACircuitBreaker(): void {
  circuitBreaker = null;
}
