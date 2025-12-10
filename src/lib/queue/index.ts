/**
 * Queue System Index
 * ==================
 *
 * Central export for all queue-related modules.
 */

// =============================================================================
// QUEUE MANAGER
// =============================================================================

export {
  QueueManager,
  initializeQueueManager,
  getQueueManager,
  QueueNames,
} from './queue-manager';
export type {
  QueueConfig,
  QueueOptions,
  JobData,
  JobResult,
  QueueName,
} from './queue-manager';

// =============================================================================
// DLQ HANDLER
// =============================================================================

export {
  DLQHandler,
  initializeDLQHandler,
  getDLQHandler,
} from './dlq-handler';
export type {
  DLQEntry,
  DLQStats,
  DLQAlertConfig,
  DLQAlert,
} from './dlq-handler';

// =============================================================================
// BASE WORKER
// =============================================================================

export {
  BaseWorker,
  TypedWorker,
  BatchWorker,
} from './workers/base.worker';
export type {
  WorkerContext,
  WorkerLogger,
  WorkerConfig,
} from './workers/base.worker';

// =============================================================================
// BULL BOARD DASHBOARD
// =============================================================================

export {
  initializeDashboard,
  getDashboardAdapter,
  getBullBoard,
  addQueueToDashboard,
  removeQueueFromDashboard,
  getDashboardStats,
  getDashboardQueue,
  shutdownDashboard,
  createDashboardMiddleware,
  createDashboardAuth,
  QUEUE_DEFINITIONS,
} from './dashboard';
export type {
  DashboardConfig,
  QueueDefinition,
} from './dashboard';

// =============================================================================
// IDEMPOTENCY STORE
// =============================================================================

export {
  IdempotencyStore,
  getIdempotencyStore,
  resetIdempotencyStore,
  generateIdempotencyKey,
  idempotentMiddleware,
} from './idempotency-store';
export type {
  IdempotencyStatus,
  IdempotencyEntry,
  IdempotencyCheckResult,
  IdempotencySetOptions,
} from './idempotency-store';

// =============================================================================
// METRICS
// =============================================================================

export {
  QueueMetricsExporter,
  getMetricsExporter,
  initializeMetrics,
  shutdownMetrics,
  METRIC_DEFINITIONS,
  ALL_QUEUES,
} from './metrics';
export type {
  QueueMetric,
  MetricsSnapshot,
  QueueStats,
} from './metrics';

// =============================================================================
// ORDERED QUEUE
// =============================================================================

export {
  OrderedQueue,
  LockManager,
  SequenceGenerator,
  createAfipOrderedQueue,
  createWhatsAppOrderedQueue,
  createOfflineSyncOrderedQueue,
  createReconciliationOrderedQueue,
} from './ordered-queue';
export type {
  OrderingMode,
  OrderedQueueConfig,
  OrderedJobData,
} from './ordered-queue';
