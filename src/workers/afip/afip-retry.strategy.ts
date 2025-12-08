/**
 * AFIP Retry Strategy
 * ===================
 *
 * Implements retry logic specific to AFIP services.
 * Uses exponential backoff with AFIP-specific delays.
 */

import { AFIPErrorType, classifyAFIPError, AFIP_ERROR_CODES } from '../../integrations/afip/afip.types';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Add jitter to delays */
  jitter: boolean;
}

export const DEFAULT_AFIP_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelay: 30000,      // 30 seconds
  maxDelay: 1800000,     // 30 minutes
  backoffMultiplier: 2,
  jitter: true,
};

// Pre-defined AFIP backoff delays (from architecture spec)
const AFIP_BACKOFF_DELAYS = [
  30000,   // 30 seconds
  120000,  // 2 minutes
  300000,  // 5 minutes
  900000,  // 15 minutes
  1800000, // 30 minutes
];

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY DECISION
// ═══════════════════════════════════════════════════════════════════════════════

export interface RetryDecision {
  shouldRetry: boolean;
  delay: number;
  reason: string;
  errorType: AFIPErrorType;
}

/**
 * Determine if an AFIP error should be retried
 */
export function shouldRetryError(
  errorCode: number | null,
  attempt: number,
  config: RetryConfig = DEFAULT_AFIP_RETRY_CONFIG
): RetryDecision {
  // Classify the error
  const errorType = errorCode ? classifyAFIPError(errorCode) : 'transient';
  const errorInfo = errorCode ? AFIP_ERROR_CODES[errorCode] : null;

  // Check max retries
  if (attempt >= config.maxRetries) {
    return {
      shouldRetry: false,
      delay: 0,
      reason: `Max retries (${config.maxRetries}) exceeded`,
      errorType,
    };
  }

  // Don't retry permanent errors
  if (errorType === 'permanent') {
    return {
      shouldRetry: false,
      delay: 0,
      reason: `Permanent error: ${errorInfo?.message || `Code ${errorCode}`}`,
      errorType,
    };
  }

  // Calculate delay
  const delay = calculateDelay(attempt, config);

  // Retry transient and authentication errors
  return {
    shouldRetry: true,
    delay,
    reason: `Transient error, retry after ${delay}ms`,
    errorType,
  };
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateDelay(attempt: number, config: RetryConfig = DEFAULT_AFIP_RETRY_CONFIG): number {
  // Use pre-defined AFIP delays if available
  if (attempt < AFIP_BACKOFF_DELAYS.length) {
    let delay = AFIP_BACKOFF_DELAYS[attempt];

    // Add jitter (±10%)
    if (config.jitter) {
      const jitterRange = delay * 0.1;
      delay += Math.random() * jitterRange * 2 - jitterRange;
    }

    return Math.min(Math.round(delay), config.maxDelay);
  }

  // Fall back to exponential backoff
  let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);

  // Add jitter
  if (config.jitter) {
    const jitterRange = delay * 0.1;
    delay += Math.random() * jitterRange * 2 - jitterRange;
  }

  return Math.min(Math.round(delay), config.maxDelay);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ErrorAnalysis {
  isRetryable: boolean;
  errorType: AFIPErrorType;
  errorCode: number | null;
  errorMessage: string;
  userMessage: string;
  action: 'retry' | 'fail' | 'fix_data' | 'contact_support';
}

/**
 * Analyze an AFIP error and determine next steps
 */
export function analyzeError(
  error: { Code: number; Msg: string } | Error | null
): ErrorAnalysis {
  if (!error) {
    return {
      isRetryable: true,
      errorType: 'transient',
      errorCode: null,
      errorMessage: 'Unknown error',
      userMessage: 'Error desconocido. Reintentando...',
      action: 'retry',
    };
  }

  // Handle AFIP error object
  if ('Code' in error) {
    const errorType = classifyAFIPError(error.Code);
    const errorInfo = AFIP_ERROR_CODES[error.Code];

    return {
      isRetryable: errorType !== 'permanent',
      errorType,
      errorCode: error.Code,
      errorMessage: error.Msg,
      userMessage: getErrorUserMessage(error.Code, error.Msg),
      action: getErrorAction(error.Code, errorType),
    };
  }

  // Handle generic Error
  const message = error.message || 'Unknown error';

  // Check for network errors
  if (message.includes('timeout') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
    return {
      isRetryable: true,
      errorType: 'transient',
      errorCode: null,
      errorMessage: message,
      userMessage: 'Error de conexión con AFIP. Reintentando...',
      action: 'retry',
    };
  }

  return {
    isRetryable: false,
    errorType: 'permanent',
    errorCode: null,
    errorMessage: message,
    userMessage: 'Error inesperado. Contacta soporte.',
    action: 'contact_support',
  };
}

/**
 * Get user-friendly error message
 */
function getErrorUserMessage(code: number, defaultMsg: string): string {
  const messages: Record<number, string> = {
    10016: 'CUIT inválido. Verificá los datos del cliente.',
    10048: 'Factura ya procesada.',
    10013: 'Punto de venta no autorizado.',
    10018: 'Fecha fuera de rango permitido.',
    10017: 'Error de cálculo. Contacta soporte.',
    502: 'AFIP no disponible. Reintentando...',
    503: 'AFIP no disponible. Reintentando...',
    600: 'Error de autenticación. Verificá la configuración.',
    601: 'Token vencido. Reautenticando...',
  };

  return messages[code] || defaultMsg || 'Error de AFIP. Reintentando...';
}

/**
 * Get recommended action for error
 */
function getErrorAction(code: number, errorType: AFIPErrorType): ErrorAnalysis['action'] {
  // Data validation errors
  if (code === 10016 || code === 10018 || code === 10017) {
    return 'fix_data';
  }

  // Configuration errors
  if (code === 10013 || code === 600) {
    return 'contact_support';
  }

  // Transient errors
  if (errorType === 'transient' || errorType === 'authentication') {
    return 'retry';
  }

  return 'fail';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: Date | null;
  openedAt: Date | null;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  openDuration: number;      // ms
  halfOpenProbes: number;
}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  openDuration: 300000,  // 5 minutes
  halfOpenProbes: 1,
};

/**
 * Simple circuit breaker implementation
 */
export class AFIPCircuitBreaker {
  private state: CircuitBreakerState = {
    state: 'closed',
    failures: 0,
    lastFailure: null,
    openedAt: null,
  };
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {
    this.config = config;
  }

  /**
   * Check if requests are allowed
   */
  canRequest(): boolean {
    this.updateState();
    return this.state.state !== 'open';
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.state = {
      state: 'closed',
      failures: 0,
      lastFailure: null,
      openedAt: null,
    };
    log.debug('Circuit breaker: success recorded, state closed');
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailure = new Date();

    if (this.state.failures >= this.config.failureThreshold) {
      this.state.state = 'open';
      this.state.openedAt = new Date();
      log.warn('Circuit breaker: opened due to failures', {
        failures: this.state.failures,
        threshold: this.config.failureThreshold,
      });
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    this.updateState();
    return { ...this.state };
  }

  /**
   * Update state based on time
   */
  private updateState(): void {
    if (this.state.state === 'open' && this.state.openedAt) {
      const elapsed = Date.now() - this.state.openedAt.getTime();
      if (elapsed >= this.config.openDuration) {
        this.state.state = 'half-open';
        log.info('Circuit breaker: transitioning to half-open');
      }
    }
  }

  /**
   * Force reset the circuit breaker
   */
  reset(): void {
    this.state = {
      state: 'closed',
      failures: 0,
      lastFailure: null,
      openedAt: null,
    };
    log.info('Circuit breaker: forced reset');
  }
}
