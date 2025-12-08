/**
 * MercadoPago Retry Strategy
 * ==========================
 *
 * Retry logic and circuit breaker for MercadoPago API calls.
 */

import { MPError, classifyMPError, MPErrorType } from '../../integrations/mercadopago/mercadopago.types';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface MPRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_MP_RETRY_CONFIG: MPRetryConfig = {
  maxRetries: 4,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY DECISION
// ═══════════════════════════════════════════════════════════════════════════════

export interface RetryDecision {
  shouldRetry: boolean;
  delayMs: number;
  reason: string;
}

/**
 * Determine if an error should be retried
 */
export function shouldRetryMPError(
  error: Error | MPError,
  attempt: number,
  config: MPRetryConfig = DEFAULT_MP_RETRY_CONFIG
): RetryDecision {
  // Check max retries
  if (attempt >= config.maxRetries) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: 'Max retries exceeded',
    };
  }

  // Classify error
  const errorType = classifyMPError(error as MPError);

  switch (errorType) {
    case 'transient':
      // Network errors, rate limits, server errors - retry with backoff
      const delay = calculateBackoff(attempt, config);
      return {
        shouldRetry: true,
        delayMs: delay,
        reason: 'Transient error, will retry',
      };

    case 'authentication':
      // Token expired - retry once after refresh
      if (attempt === 0) {
        return {
          shouldRetry: true,
          delayMs: 0, // Immediate retry after token refresh
          reason: 'Authentication error, refreshing token',
        };
      }
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: 'Authentication failed after token refresh',
      };

    case 'permanent':
    default:
      // Bad request, invalid data - don't retry
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: 'Permanent error, will not retry',
      };
  }
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(
  attempt: number,
  config: MPRetryConfig = DEFAULT_MP_RETRY_CONFIG
): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.2 * delay; // Add 0-20% jitter
  return Math.min(delay + jitter, config.maxDelayMs);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface MPCircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  openDurationMs: number;
  halfOpenRequests: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  openedAt: Date | null;
}

export const DEFAULT_CIRCUIT_CONFIG: MPCircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  openDurationMs: 30000, // 30 seconds
  halfOpenRequests: 3,
};

export class MPCircuitBreaker {
  private config: MPCircuitBreakerConfig;
  private state: CircuitBreakerState;
  private halfOpenAttempts = 0;

  constructor(config: Partial<MPCircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    this.state = {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailure: null,
      openedAt: null,
    };
  }

  /**
   * Check if request is allowed
   */
  canRequest(): boolean {
    this.checkStateTransition();

    switch (this.state.state) {
      case 'closed':
        return true;

      case 'open':
        return false;

      case 'half-open':
        // Allow limited requests in half-open
        return this.halfOpenAttempts < this.config.halfOpenRequests;
    }
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    switch (this.state.state) {
      case 'closed':
        this.state.failures = 0;
        break;

      case 'half-open':
        this.state.successes++;
        if (this.state.successes >= this.config.successThreshold) {
          this.transitionTo('closed');
        }
        break;
    }
  }

  /**
   * Record failed request
   */
  recordFailure(error?: Error | MPError): void {
    this.state.failures++;
    this.state.lastFailure = new Date();

    // Check if error type should trip the circuit
    if (error) {
      const errorType = classifyMPError(error as MPError);
      if (errorType === 'permanent') {
        // Permanent errors shouldn't trip the circuit
        return;
      }
    }

    switch (this.state.state) {
      case 'closed':
        if (this.state.failures >= this.config.failureThreshold) {
          this.transitionTo('open');
        }
        break;

      case 'half-open':
        // Any failure in half-open returns to open
        this.transitionTo('open');
        break;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    this.checkStateTransition();
    return { ...this.state };
  }

  /**
   * Force reset to closed state
   */
  reset(): void {
    this.transitionTo('closed');
    this.state.failures = 0;
    this.state.successes = 0;
    this.state.lastFailure = null;
    this.state.openedAt = null;
    this.halfOpenAttempts = 0;
  }

  private checkStateTransition(): void {
    if (this.state.state === 'open' && this.state.openedAt) {
      const elapsed = Date.now() - this.state.openedAt.getTime();
      if (elapsed >= this.config.openDurationMs) {
        this.transitionTo('half-open');
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state.state;

    log.info('Circuit breaker state transition', {
      from: oldState,
      to: newState,
      failures: this.state.failures,
    });

    this.state.state = newState;

    switch (newState) {
      case 'open':
        this.state.openedAt = new Date();
        break;

      case 'half-open':
        this.halfOpenAttempts = 0;
        this.state.successes = 0;
        break;

      case 'closed':
        this.state.failures = 0;
        this.state.successes = 0;
        this.state.openedAt = null;
        this.halfOpenAttempts = 0;
        break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY WITH CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

export interface RetryWithCircuitBreakerOptions<T> {
  operation: () => Promise<T>;
  circuitBreaker: MPCircuitBreaker;
  config?: MPRetryConfig;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Execute operation with retry and circuit breaker
 */
export async function retryWithCircuitBreaker<T>(
  options: RetryWithCircuitBreakerOptions<T>
): Promise<T> {
  const config = options.config || DEFAULT_MP_RETRY_CONFIG;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    // Check circuit breaker
    if (!options.circuitBreaker.canRequest()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await options.operation();
      options.circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      const err = error as Error | MPError;
      options.circuitBreaker.recordFailure(err);

      const decision = shouldRetryMPError(err, attempt, config);

      if (!decision.shouldRetry) {
        throw error;
      }

      if (options.onRetry) {
        options.onRetry(attempt, err as Error);
      }

      if (decision.delayMs > 0) {
        await sleep(decision.delayMs);
      }
    }
  }

  throw new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
