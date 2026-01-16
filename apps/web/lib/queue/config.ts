/**
 * CampoTech Queue Configuration (Phase 5B.1.1)
 * =============================================
 *
 * Queue configuration with 3 tiers optimized for serverless:
 * - Realtime: <5s SLA (notifications, webhooks)
 * - Background: <60s SLA (emails, sync tasks)
 * - Batch: minutes-hours (reports, analytics, archival)
 *
 * Uses Upstash Redis for serverless-compatible queue management.
 *
 * @see https://upstash.com/docs/redis/overall/getstarted
 */

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE TIER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Queue tiers with SLAs and processing characteristics
 */
export const QUEUE_TIERS = {
  /**
   * Realtime tier: Critical, time-sensitive jobs
   * SLA: <5 seconds
   * Use for: Notifications, webhooks, real-time updates
   */
  realtime: {
    name: 'realtime',
    priority: 1,
    slaMs: 5000,
    concurrency: 10,
    maxRetries: 2,
    retryDelayMs: 1000,
    timeout: 10000,
    description: 'Critical, time-sensitive jobs (<5s SLA)',
  },

  /**
   * Background tier: Standard async processing
   * SLA: <60 seconds
   * Use for: Emails, data sync, image processing
   */
  background: {
    name: 'background',
    priority: 2,
    slaMs: 60000,
    concurrency: 5,
    maxRetries: 3,
    retryDelayMs: 5000,
    timeout: 60000,
    description: 'Standard async processing (<60s SLA)',
  },

  /**
   * Batch tier: Long-running, resource-intensive jobs
   * SLA: minutes to hours
   * Use for: Reports, analytics aggregation, data archival, exports
   */
  batch: {
    name: 'batch',
    priority: 3,
    slaMs: 3600000, // 1 hour
    concurrency: 2,
    maxRetries: 5,
    retryDelayMs: 30000,
    timeout: 600000, // 10 minutes
    description: 'Long-running batch jobs (minutes-hours SLA)',
  },
} as const;

export type QueueTier = keyof typeof QUEUE_TIERS;
export type QueueTierConfig = (typeof QUEUE_TIERS)[QueueTier];

// ═══════════════════════════════════════════════════════════════════════════════
// JOB TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registered job types with their tier assignments
 */
export const JOB_TYPES = {
  // Realtime jobs
  'notification.push': { tier: 'realtime' as const, description: 'Push notification to user' },
  'notification.inApp': { tier: 'realtime' as const, description: 'In-app notification' },
  'webhook.send': { tier: 'realtime' as const, description: 'Send webhook to external service' },
  'sync.realtime': { tier: 'realtime' as const, description: 'Real-time data sync' },
  'job.statusNotify': { tier: 'realtime' as const, description: 'Notify on job status change' },

  // Background jobs
  'email.send': { tier: 'background' as const, description: 'Send email' },
  'email.bulk': { tier: 'background' as const, description: 'Send bulk emails' },
  'sms.send': { tier: 'background' as const, description: 'Send SMS' },
  'whatsapp.send': { tier: 'background' as const, description: 'Send WhatsApp message' },
  'whatsapp.template': { tier: 'background' as const, description: 'Send WhatsApp template message' },
  'whatsapp.aiProcess': { tier: 'background' as const, description: 'Process WhatsApp message with AI' },
  'voice.transcribe': { tier: 'background' as const, description: 'Transcribe voice message with Whisper' },
  'image.process': { tier: 'background' as const, description: 'Process/resize image' },
  'pdf.generate': { tier: 'background' as const, description: 'Generate PDF document' },
  'invoice.generate': { tier: 'background' as const, description: 'Generate invoice' },
  'invoice.afip': { tier: 'background' as const, description: 'Generate AFIP electronic invoice' },
  'sync.data': { tier: 'background' as const, description: 'Sync data between services' },
  'cache.invalidate': { tier: 'background' as const, description: 'Invalidate cache entries' },
  'job.sendDocuments': { tier: 'background' as const, description: 'Send completion documents to customer' },

  // Batch jobs
  'report.generate': { tier: 'batch' as const, description: 'Generate analytics report' },
  'analytics.aggregate': { tier: 'batch' as const, description: 'Aggregate analytics data' },
  'data.export': { tier: 'batch' as const, description: 'Export data to file' },
  'data.import': { tier: 'batch' as const, description: 'Import data from file' },
  'data.archive': { tier: 'batch' as const, description: 'Archive old data' },
  'cleanup.expired': { tier: 'batch' as const, description: 'Cleanup expired records' },
  'billing.process': { tier: 'batch' as const, description: 'Process billing cycle' },
  'audit.generate': { tier: 'batch' as const, description: 'Generate audit log' },
} as const;

export type JobType = keyof typeof JOB_TYPES;

// ═══════════════════════════════════════════════════════════════════════════════
// JOB STATUS
// ═══════════════════════════════════════════════════════════════════════════════

export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying',
  DEAD: 'dead', // Failed after all retries
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS KEY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Redis key prefixes for queue management
 */
export const QUEUE_KEYS = {
  /** Queue prefix: queue:{tier}:{jobType} */
  QUEUE: 'queue',
  /** Job data: job:{jobId} */
  JOB: 'job',
  /** Job status: job:status:{jobId} */
  JOB_STATUS: 'job:status',
  /** Idempotency key: idempotency:{key} */
  IDEMPOTENCY: 'idempotency',
  /** Dead letter queue: dlq:{tier} */
  DLQ: 'dlq',
  /** Processing lock: lock:{jobId} */
  LOCK: 'lock',
  /** Metrics: metrics:{tier}:{metric} */
  METRICS: 'metrics',
} as const;

/**
 * Build queue key for a specific tier
 */
export function queueKey(tier: QueueTier): string {
  return `${QUEUE_KEYS.QUEUE}:${tier}`;
}

/**
 * Build job key
 */
export function jobKey(jobId: string): string {
  return `${QUEUE_KEYS.JOB}:${jobId}`;
}

/**
 * Build job status key
 */
export function jobStatusKey(jobId: string): string {
  return `${QUEUE_KEYS.JOB_STATUS}:${jobId}`;
}

/**
 * Build idempotency key
 */
export function idempotencyKey(key: string): string {
  return `${QUEUE_KEYS.IDEMPOTENCY}:${key}`;
}

/**
 * Build dead letter queue key
 */
export function dlqKey(tier: QueueTier): string {
  return `${QUEUE_KEYS.DLQ}:${tier}`;
}

/**
 * Build processing lock key
 */
export function lockKey(jobId: string): string {
  return `${QUEUE_KEYS.LOCK}:${jobId}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Global queue configuration
 */
export const QUEUE_CONFIG = {
  /** Default job TTL in seconds (7 days) */
  defaultJobTtl: 7 * 24 * 60 * 60,

  /** Idempotency key TTL in seconds (24 hours) */
  idempotencyTtl: 24 * 60 * 60,

  /** Lock TTL in seconds (5 minutes) - auto-releases if worker crashes */
  lockTtl: 5 * 60,

  /** Polling interval for workers in milliseconds */
  pollInterval: parseInt(process.env.QUEUE_POLL_INTERVAL || '1000', 10),

  /** Maximum jobs to fetch per poll */
  batchSize: parseInt(process.env.QUEUE_BATCH_SIZE || '10', 10),

  /** Enable debug logging */
  debug: process.env.QUEUE_DEBUG === 'true',

  /** Metrics retention in seconds (24 hours) */
  metricsRetention: 24 * 60 * 60,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// JOB INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Job payload interface
 */
export interface Job<T = unknown> {
  /** Unique job identifier */
  id: string;

  /** Job type (determines handler) */
  type: JobType;

  /** Job tier (determines priority and SLA) */
  tier: QueueTier;

  /** Job payload data */
  data: T;

  /** Optional idempotency key for deduplication */
  idempotencyKey?: string;

  /** Current status */
  status: JobStatus;

  /** Number of attempts made */
  attempts: number;

  /** Maximum retry attempts */
  maxRetries: number;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Scheduled execution time (for delayed jobs) */
  scheduledAt?: Date;

  /** Processing started timestamp */
  startedAt?: Date;

  /** Completion timestamp */
  completedAt?: Date;

  /** Error message if failed */
  error?: string;

  /** Result data if completed */
  result?: unknown;

  /** Organization ID for multi-tenancy */
  organizationId?: string;

  /** User ID who triggered the job */
  userId?: string;

  /** Correlation ID for tracing */
  correlationId?: string;
}

/**
 * Job options for dispatching
 */
export interface JobOptions {
  /** Override the default tier */
  tier?: QueueTier;

  /** Idempotency key for deduplication */
  idempotencyKey?: string;

  /** Delay execution by milliseconds */
  delay?: number;

  /** Override max retries */
  maxRetries?: number;

  /** Organization context */
  organizationId?: string;

  /** User context */
  userId?: string;

  /** Correlation ID for distributed tracing */
  correlationId?: string;

  /** Priority within tier (lower = higher priority) */
  priority?: number;
}

/**
 * Job result wrapper
 */
export interface JobResult<T = unknown> {
  success: boolean;
  jobId: string;
  data?: T;
  error?: string;
  duration?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get tier configuration for a job type
 */
export function getTierForJobType(jobType: JobType): QueueTierConfig {
  const config = JOB_TYPES[jobType];
  return QUEUE_TIERS[config.tier];
}

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `job_${timestamp}_${random}`;
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(attempt: number, baseDelayMs: number): number {
  // Exponential backoff with jitter: delay * 2^attempt + random jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 300000); // Cap at 5 minutes
}

/**
 * Check if queue system is configured
 */
export function isQueueConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}
