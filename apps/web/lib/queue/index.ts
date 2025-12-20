/**
 * CampoTech Queue Module (Phase 5B + 6.2)
 * ========================================
 *
 * Central queue management for background job processing.
 *
 * Features:
 * - 3-tier queue system (realtime, background, batch)
 * - Idempotent job dispatch
 * - Worker processors with automatic retries
 * - Dead letter queue with advanced handling (Phase 5B.3)
 * - Metrics collection with Little's Law analysis (Phase 5B.2)
 * - Integrated processors for email, WhatsApp, AI, voice (Phase 6.2)
 *
 * Basic usage:
 * ```typescript
 * import { dispatch, dispatchEmail, dispatchNotification } from '@/lib/queue';
 *
 * // Dispatch a job
 * await dispatch('email.send', {
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 * });
 *
 * // With idempotency (prevents duplicates)
 * await dispatch('notification.push', { ... }, {
 *   idempotencyKey: `welcome-${userId}`,
 * });
 *
 * // Convenience methods
 * await dispatchEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   body: 'Hello world',
 * });
 *
 * await dispatchNotification({
 *   userId: 'user-123',
 *   title: 'New message',
 *   body: 'You have a new message',
 * });
 * ```
 *
 * Starting workers (in a separate process):
 * ```typescript
 * import { startWorkers, registerAllProcessors } from '@/lib/queue';
 *
 * registerAllProcessors(); // Registers email, WhatsApp, AI, voice handlers
 * await startWorkers(['realtime', 'background']);
 * ```
 */

export {
  // Configuration
  QUEUE_TIERS,
  QUEUE_CONFIG,
  JOB_TYPES,
  JOB_STATUS,
  QUEUE_KEYS,

  // Key builders
  queueKey,
  jobKey,
  jobStatusKey,
  idempotencyKey,
  dlqKey,
  lockKey,

  // Utility functions
  getTierForJobType,
  generateJobId,
  calculateBackoff,
  isQueueConfigured,

  // Types
  type QueueTier,
  type QueueTierConfig,
  type JobType,
  type JobStatus,
  type Job,
  type JobOptions,
  type JobResult,
} from './config';

export {
  // Core dispatch functions
  dispatch,
  dispatchBatch,
  dispatchDelayed,
  dispatchScheduled,

  // Convenience dispatch methods
  dispatchEmail,
  dispatchNotification,
  dispatchWebhook,
  dispatchReport,

  // Job management
  getJob,
  getJobStatus,
  updateJobStatus,
  cancelJob,
  retryJob,

  // Queue operations
  getQueueLength,
  getQueueStats,

  // Idempotency
  clearIdempotency,

  // State
  isDispatcherReady,
} from './dispatcher';

export {
  // Handler registration
  registerHandler,
  hasHandler,
  registerDefaultHandlers,

  // Worker control
  startWorkers,
  stopWorkers,
  isWorkersRunning,
  getWorkerStats,

  // Dead letter queue
  getDeadLetterJobs,
  retryDeadLetterQueue,
  clearDeadLetterQueue,

  // Types
  type JobHandler,
} from './workers';

export {
  // Metric recording
  recordJobEnqueued,
  recordJobCompleted,
  recordJobFailed,

  // Metric retrieval
  getQueueMetrics,
  getHistoricalMetrics,

  // Little's Law analysis
  analyzeLittleLaw,

  // Maintenance
  resetMetrics,
  getJobTypeBreakdown,

  // Types
  type TierMetrics,
  type QueueMetrics,
  type LittleLawAnalysis,
  type HistoricalMetrics,
  type MetricDataPoint,
} from './metrics';

export {
  // DLQ Handler (Phase 5B.3)
  DLQHandler,

  // DLQ Statistics
  getDlqStats,
  getDlqHealth,

  // DLQ Analysis
  analyzeDlqErrors,

  // Types
  type DLQEntry,
  type DLQStats,
  type DLQPolicy,
  type ErrorCategory,
  type DLQAction,
  type ErrorPattern,
  type DLQEventHandlers,
} from './dlq';

export {
  // Processor registration (Phase 6.2)
  registerAllProcessors,

  // Individual handlers for testing
  emailSendHandler,
  emailBulkHandler,
  whatsappSendHandler,
  whatsappTemplateHandler,
  whatsappAIProcessHandler,
  voiceTranscribeHandler,
  invoiceGenerateHandler,
  afipInvoiceHandler,
  pushNotificationHandler,
  inAppNotificationHandler,
  jobStatusNotifyHandler,
  webhookHandler,

  // Types
  type EmailJobData,
  type WhatsAppSendData,
  type WhatsAppTemplateData,
  type WhatsAppAIProcessData,
  type VoiceTranscribeData,
  type InvoiceGenerateData,
  type AFIPInvoiceData,
  type JobStatusNotifyData,
  type PushNotificationData,
  type WebhookData,
} from './processors';
