/**
 * AFIP Workers Index
 * ==================
 *
 * Background workers for AFIP integration
 */

export {
  AFIPInvoiceWorker,
  getAFIPWorker,
  resetAFIPWorker,
} from './afip-invoice.worker';
export type { WorkerConfig } from './afip-invoice.worker';

export {
  shouldRetryError,
  calculateDelay,
  analyzeError,
  AFIPCircuitBreaker,
  DEFAULT_AFIP_RETRY_CONFIG,
} from './afip-retry.strategy';
export type {
  RetryConfig,
  RetryDecision,
  ErrorAnalysis,
  CircuitBreakerState,
  CircuitBreakerConfig,
} from './afip-retry.strategy';

export {
  AFIPFallbackHandler,
} from './afip-fallback.handler';
export type {
  PanicModeState,
  PanicModeConfig,
} from './afip-fallback.handler';
