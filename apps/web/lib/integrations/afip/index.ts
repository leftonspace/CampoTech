/**
 * AFIP Integration Module
 * =======================
 *
 * Central export file for AFIP integration in the web application.
 *
 * Usage:
 *   import { getAFIPClient } from '@/lib/integrations/afip';
 *   const client = getAFIPClient();
 *   await client.requestCAE(invoiceId, orgId);
 *
 * Components:
 * - AFIPClient: Main client with unified API
 * - Rate Limiter: Controls request rate to AFIP
 * - Circuit Breaker: Prevents cascading failures
 * - Batch Processor: Efficient batch processing
 */

// Main client
export { AFIPClient, getAFIPClient, resetAFIPClient } from './client';

// Rate limiter
export {
  AFIPRateLimiter,
  PerOrgRateLimiter,
  CombinedRateLimiter,
  getAFIPRateLimiter,
  resetAFIPRateLimiter,
} from './rate-limiter';

// Circuit breaker
export {
  AFIPCircuitBreaker,
  PerOrgCircuitBreaker,
  CircuitBreakerOpenError,
  getAFIPCircuitBreaker,
  resetAFIPCircuitBreaker,
} from './circuit-breaker';

// Batch processor
export {
  AFIPBatchProcessor,
  processInvoiceImmediate,
  getAFIPBatchProcessor,
  stopAFIPBatchProcessor,
} from './batch-processor';

// Types
export type {
  // Rate limiter types
  RateLimiterConfig,
  RateLimiterState,
  // Circuit breaker types
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  // Batch processor types
  BatchConfig,
  BatchJob,
  BatchJobStatus,
  BatchResult,
  BatchJobResult,
  // Status types
  AFIPSystemStatus,
  QueueMetrics,
  PerformanceMetrics,
  // Client options
  AFIPClientOptions,
} from './types';

// Re-export core AFIP types
export type {
  AFIPEnvironment,
  AFIPConfig,
  AFIPInvoiceType,
  AFIPDocumentType,
  AFIPConceptType,
  AFIPCurrency,
  AFIPInvoiceInput,
  AFIPJobData,
  AFIPJobResult,
  CAEResult,
  AFIPError,
  AFIPErrorType,
} from './types';

export {
  AFIP_ENDPOINTS,
  AFIP_IVA_RATES,
  AFIP_ERROR_CODES,
  classifyAFIPError,
  DEFAULT_AFIP_CLIENT_OPTIONS,
} from './types';
