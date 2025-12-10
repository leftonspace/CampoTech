/**
 * Payment Workers Index
 * =====================
 *
 * Background workers for MercadoPago payment processing
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT WEBHOOK WORKER (BullMQ)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Queue
  getPaymentWebhookQueue,
  queuePaymentWebhook,
  getQueueStatus as getPaymentWebhookQueueStatus,
  // Worker
  startPaymentWebhookWorker,
  stopPaymentWebhookWorker,
  // Management
  retryFailedJob as retryPaymentWebhookJob,
  getFailedJobs as getPaymentWebhookFailedJobs,
  pauseQueue as pausePaymentWebhookQueue,
  resumeQueue as resumePaymentWebhookQueue,
} from './payment-webhook.worker';
export type {
  PaymentWebhookJobData,
  PaymentWebhookJobResult,
} from './payment-webhook.worker';

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY PAYMENT WORKER (Database Polling)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  MPPaymentWorker,
  getMPPaymentWorker,
  setMPPaymentWorker,
  resetMPPaymentWorker,
} from './mp-payment.worker';
export type {
  PaymentWorkerConfig,
  PaymentJob,
  PaymentJobResult,
} from './mp-payment.worker';

export {
  MPReconciliationService,
  ScheduledReconciliation,
} from './mp-reconciliation.service';
export type {
  ReconciliationConfig,
  LocalPaymentRecord,
  ReconciliationCallbacks,
  ScheduledReconciliationConfig,
} from './mp-reconciliation.service';

export {
  shouldRetryMPError,
  calculateBackoff,
  MPCircuitBreaker,
  retryWithCircuitBreaker,
  DEFAULT_MP_RETRY_CONFIG,
  DEFAULT_CIRCUIT_CONFIG,
} from './mp-retry.strategy';
export type {
  MPRetryConfig,
  RetryDecision,
  MPCircuitBreakerConfig,
  CircuitBreakerState,
  CircuitState,
  RetryWithCircuitBreakerOptions,
} from './mp-retry.strategy';

// ═══════════════════════════════════════════════════════════════════════════════
// PANIC CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export {
  MPPanicController,
  getMPPanicController,
  initializeMPPanicController,
  resetMPPanicController,
  canProcessMPPayment,
  recordMPPaymentResult,
} from './mp-panic-controller';
export type {
  MPPanicConfig,
  PaymentMetrics,
  PanicCheckResult,
} from './mp-panic-controller';

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export {
  MPFallbackHandler,
  getMPFallbackHandler,
  initializeMPFallbackHandler,
  handleMPFallback,
} from './mp-fallback.handler';
export type {
  FallbackReason,
  FallbackPayment,
  FallbackResult,
  FallbackConfig,
} from './mp-fallback.handler';
