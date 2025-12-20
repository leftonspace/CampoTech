/**
 * AFIP Integration Types for Web App
 * ===================================
 *
 * Type definitions for AFIP client wrapper in the web application layer.
 * Re-exports and extends types from the core AFIP integration.
 */

// Re-export core types
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
} from '@/../../src/integrations/afip/afip.types';

export {
  AFIP_ENDPOINTS,
  AFIP_IVA_RATES,
  AFIP_ERROR_CODES,
  classifyAFIPError,
} from '@/../../src/integrations/afip/afip.types';

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Optional: Burst allowance */
  burstAllowance?: number;
}

export interface RateLimiterState {
  /** Current request count in window */
  currentCount: number;
  /** Remaining requests in window */
  remaining: number;
  /** Window reset timestamp */
  resetAt: Date;
  /** Is rate limited */
  isLimited: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Number of failures before opening */
  failureThreshold: number;
  /** Duration to keep circuit open (ms) */
  openDuration: number;
  /** Number of test requests in half-open state */
  halfOpenProbes: number;
  /** Time window for failure counting (ms) */
  failureWindow?: number;
}

export interface CircuitBreakerStatus {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  openedAt: Date | null;
  nextRetryAt: Date | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH PROCESSOR TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BatchConfig {
  /** Maximum batch size */
  maxBatchSize: number;
  /** Maximum concurrent batches */
  maxConcurrency: number;
  /** Delay between batches (ms) */
  batchDelayMs: number;
  /** Priority ordering */
  priorityEnabled: boolean;
}

export interface BatchJob {
  id: string;
  invoiceId: string;
  orgId: string;
  priority: 'high' | 'normal' | 'low';
  createdAt: Date;
  attempts: number;
  lastError?: string;
  status: BatchJobStatus;
}

export type BatchJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying';

export interface BatchResult {
  batchId: string;
  processedAt: Date;
  totalJobs: number;
  successCount: number;
  failedCount: number;
  results: BatchJobResult[];
}

export interface BatchJobResult {
  jobId: string;
  invoiceId: string;
  success: boolean;
  cae?: string;
  caeExpiry?: Date;
  invoiceNumber?: number;
  error?: string;
  errorCode?: number;
  processingTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS DASHBOARD TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AFIPSystemStatus {
  /** Overall system health */
  health: 'healthy' | 'degraded' | 'critical';
  /** AFIP connectivity status */
  afipConnectivity: 'online' | 'offline' | 'unknown';
  /** Rate limiter status */
  rateLimiter: RateLimiterState;
  /** Circuit breaker status */
  circuitBreaker: CircuitBreakerStatus;
  /** Queue metrics */
  queue: QueueMetrics;
  /** Recent performance */
  performance: PerformanceMetrics;
  /** Last updated */
  updatedAt: Date;
}

export interface QueueMetrics {
  /** Total pending invoices */
  pending: number;
  /** Processing now */
  processing: number;
  /** Completed today */
  completedToday: number;
  /** Failed today */
  failedToday: number;
  /** Average wait time (ms) */
  avgWaitTime: number;
  /** Oldest pending item age (ms) */
  oldestPendingAge: number;
}

export interface PerformanceMetrics {
  /** Requests in last hour */
  requestsLastHour: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average latency (ms) */
  avgLatency: number;
  /** P95 latency (ms) */
  p95Latency: number;
  /** Errors in last hour */
  errorsLastHour: number;
  /** Top error codes */
  topErrorCodes: Array<{ code: number; count: number; message: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface AFIPClientOptions {
  /** Rate limiter configuration */
  rateLimiter?: Partial<RateLimiterConfig>;
  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Batch processor configuration */
  batch?: Partial<BatchConfig>;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom timeout (ms) */
  timeout?: number;
}

export const DEFAULT_AFIP_CLIENT_OPTIONS: Required<AFIPClientOptions> = {
  rateLimiter: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
    burstAllowance: 2,
  },
  circuitBreaker: {
    failureThreshold: 5,
    openDuration: 300000, // 5 minutes
    halfOpenProbes: 1,
    failureWindow: 60000, // 1 minute
  },
  batch: {
    maxBatchSize: 10,
    maxConcurrency: 2,
    batchDelayMs: 5000,
    priorityEnabled: true,
  },
  debug: false,
  timeout: 30000,
};
