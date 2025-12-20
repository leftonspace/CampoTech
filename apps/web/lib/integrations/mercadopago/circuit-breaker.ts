/**
 * MercadoPago Circuit Breaker
 * ===========================
 *
 * Circuit breaker implementation for MercadoPago API calls.
 * Prevents cascading failures when MP service is degraded.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service down, fail fast without calling MP
 * - HALF-OPEN: Testing recovery, limited requests allowed
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

export class MPCircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private halfOpenRequests: number = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private openedAt: Date | null = null;
  private config: CircuitBreakerConfig;

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
        // Allow limited requests in half-open
        return this.halfOpenRequests < this.config.halfOpenRequests;

      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.lastSuccess = new Date();

    switch (this.state) {
      case 'closed':
        // Reset failure count on success
        this.failures = 0;
        break;

      case 'half-open':
        this.successes++;
        this.halfOpenRequests++;

        // Transition to closed if enough successes
        if (this.successes >= this.config.successThreshold) {
          this.transitionTo('closed');
        }
        break;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(error?: Error): void {
    this.failures++;
    this.lastFailure = new Date();

    // Log for debugging
    console.warn('[MP Circuit Breaker] Failure recorded:', {
      failures: this.failures,
      threshold: this.config.failureThreshold,
      state: this.state,
      error: error?.message,
    });

    switch (this.state) {
      case 'closed':
        // Open circuit if threshold reached
        if (this.failures >= this.config.failureThreshold) {
          this.transitionTo('open');
        }
        break;

      case 'half-open':
        // Any failure in half-open goes back to open
        this.transitionTo('open');
        break;
    }
  }

  /**
   * Get current circuit status
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
   * Force circuit to specific state (for admin/testing)
   */
  forceState(state: CircuitState): void {
    console.warn(`[MP Circuit Breaker] Force transition to ${state}`);
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
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INTERNAL METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if state should transition based on time
   */
  private checkStateTransition(): void {
    if (this.state === 'open' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt.getTime();
      if (elapsed >= this.config.openDurationMs) {
        this.transitionTo('half-open');
      }
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;

    console.log(`[MP Circuit Breaker] ${previousState} → ${newState}`);

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

  /**
   * Get next retry time (when circuit will try half-open)
   */
  private getNextRetryTime(): Date | null {
    if (this.state !== 'open' || !this.openedAt) {
      return null;
    }

    return new Date(this.openedAt.getTime() + this.config.openDurationMs);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  exponentialBase: 2,
};

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Check for specific error properties
  const err = error as { status?: number; code?: string; message?: string };

  // Rate limiting
  if (err.status === 429) return true;

  // Server errors (temporary)
  if (err.status && err.status >= 500 && err.status < 600) return true;

  // Network-related error codes
  const retryableCodes = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
  ];
  if (err.code && retryableCodes.includes(err.code)) return true;

  // Timeout messages
  if (err.message && /timeout/i.test(err.message)) return true;

  return false;
}

/**
 * Calculate delay for retry attempt
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.baseDelayMs * Math.pow(config.exponentialBase, attempt);
  const jitter = Math.random() * 0.3 * delay; // 30% jitter
  return Math.min(delay + jitter, config.maxDelayMs);
}

/**
 * Execute with retry logic
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === retryConfig.maxRetries || !isRetryableError(error)) {
        throw lastError;
      }

      const delay = calculateRetryDelay(attempt, retryConfig);
      console.log(
        `[MP Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        lastError.message
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED CIRCUIT BREAKER + RETRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute function with circuit breaker and retry logic
 */
export async function executeWithResilience<T>(
  circuitBreaker: MPCircuitBreaker,
  fn: () => Promise<T>,
  options: {
    retry?: Partial<RetryConfig>;
    onCircuitOpen?: () => void;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  // Check circuit breaker first
  if (!circuitBreaker.canRequest()) {
    const status = circuitBreaker.getStatus();
    options.onCircuitOpen?.();
    throw new CircuitOpenError(
      'Circuit breaker is open',
      status.nextRetryAt || undefined
    );
  }

  try {
    const result = await retryWithBackoff(fn, options.retry);
    circuitBreaker.recordSuccess();
    return result;
  } catch (error) {
    circuitBreaker.recordFailure(error instanceof Error ? error : undefined);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
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

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let globalCircuitBreaker: MPCircuitBreaker | null = null;

export function getMPCircuitBreaker(): MPCircuitBreaker {
  if (!globalCircuitBreaker) {
    globalCircuitBreaker = new MPCircuitBreaker();
  }
  return globalCircuitBreaker;
}

export function resetMPCircuitBreaker(): void {
  globalCircuitBreaker = null;
}
