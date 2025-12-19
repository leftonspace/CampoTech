/**
 * CampoTech Job Dispatcher (Phase 5B.1.2)
 * ========================================
 *
 * Job dispatcher with idempotency support for reliable job processing.
 *
 * Features:
 * - Idempotency keys prevent duplicate job processing
 * - Automatic tier assignment based on job type
 * - Delayed job scheduling
 * - Priority within tiers
 * - Distributed tracing support
 *
 * Usage:
 * ```typescript
 * import { dispatch, dispatchBatch } from '@/lib/queue/dispatcher';
 *
 * // Dispatch a single job
 * const job = await dispatch('email.send', {
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   body: 'Hello world',
 * }, {
 *   idempotencyKey: `email-welcome-${userId}`,
 * });
 *
 * // Dispatch with delay
 * await dispatch('notification.push', { ... }, {
 *   delay: 60000, // 1 minute delay
 * });
 *
 * // Batch dispatch
 * await dispatchBatch([
 *   { type: 'email.send', data: { ... } },
 *   { type: 'sms.send', data: { ... } },
 * ]);
 * ```
 */

import { redis } from '../cache';
import {
  type Job,
  type JobOptions,
  type JobResult,
  type JobType,
  type QueueTier,
  JOB_TYPES,
  QUEUE_TIERS,
  QUEUE_CONFIG,
  JOB_STATUS,
  queueKey,
  jobKey,
  jobStatusKey,
  idempotencyKey,
  generateJobId,
  isQueueConfigured,
} from './config';

// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCHER STATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if dispatcher is available
 */
export function isDispatcherReady(): boolean {
  return isQueueConfigured() && redis !== null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE DISPATCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Dispatch a job to the queue
 *
 * @param type - Job type (determines handler and default tier)
 * @param data - Job payload
 * @param options - Optional job configuration
 * @returns Job result with ID and status
 *
 * @example
 * const result = await dispatch('email.send', {
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 * });
 * console.log('Job dispatched:', result.jobId);
 */
export async function dispatch<T = unknown>(
  type: JobType,
  data: T,
  options: JobOptions = {}
): Promise<JobResult> {
  // Check if queue is configured
  if (!isDispatcherReady()) {
    if (QUEUE_CONFIG.debug) {
      console.warn('[Queue] Dispatcher not ready - queue not configured');
    }
    // In development, we might want to process synchronously
    return {
      success: false,
      jobId: '',
      error: 'Queue not configured',
    };
  }

  try {
    // Check idempotency
    if (options.idempotencyKey) {
      const existingJobId = await checkIdempotency(options.idempotencyKey);
      if (existingJobId) {
        if (QUEUE_CONFIG.debug) {
          console.log(`[Queue] Job already exists for idempotency key: ${options.idempotencyKey}`);
        }
        return {
          success: true,
          jobId: existingJobId,
          data: { deduplicated: true },
        };
      }
    }

    // Determine tier
    const jobConfig = JOB_TYPES[type];
    const tier: QueueTier = options.tier || jobConfig.tier;
    const tierConfig = QUEUE_TIERS[tier];

    // Generate job ID
    const jobId = generateJobId();

    // Create job object
    const now = new Date();
    const job: Job<T> = {
      id: jobId,
      type,
      tier,
      data,
      idempotencyKey: options.idempotencyKey,
      status: JOB_STATUS.PENDING,
      attempts: 0,
      maxRetries: options.maxRetries ?? tierConfig.maxRetries,
      createdAt: now,
      updatedAt: now,
      scheduledAt: options.delay ? new Date(now.getTime() + options.delay) : undefined,
      organizationId: options.organizationId,
      userId: options.userId,
      correlationId: options.correlationId,
    };

    // Store job data
    await storeJob(job);

    // Set idempotency key if provided
    if (options.idempotencyKey) {
      await setIdempotency(options.idempotencyKey, jobId);
    }

    // Calculate priority score (lower = higher priority)
    const priorityScore = calculatePriorityScore(job, options.priority);

    // Add to queue (sorted set by priority/scheduled time)
    await addToQueue(tier, jobId, priorityScore);

    if (QUEUE_CONFIG.debug) {
      console.log(`[Queue] Job dispatched: ${jobId} (${type}) to ${tier} queue`);
    }

    return {
      success: true,
      jobId,
    };
  } catch (error) {
    console.error('[Queue] Error dispatching job:', error);
    return {
      success: false,
      jobId: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Dispatch multiple jobs in a batch
 *
 * @param jobs - Array of job definitions
 * @returns Array of job results
 */
export async function dispatchBatch(
  jobs: Array<{
    type: JobType;
    data: unknown;
    options?: JobOptions;
  }>
): Promise<JobResult[]> {
  const results = await Promise.all(
    jobs.map(({ type, data, options }) => dispatch(type, data, options))
  );
  return results;
}

/**
 * Dispatch a job with a specific delay
 *
 * @param type - Job type
 * @param data - Job payload
 * @param delayMs - Delay in milliseconds
 * @param options - Additional options
 */
export async function dispatchDelayed<T = unknown>(
  type: JobType,
  data: T,
  delayMs: number,
  options: Omit<JobOptions, 'delay'> = {}
): Promise<JobResult> {
  return dispatch(type, data, { ...options, delay: delayMs });
}

/**
 * Dispatch a job scheduled for a specific time
 *
 * @param type - Job type
 * @param data - Job payload
 * @param scheduledAt - When to execute the job
 * @param options - Additional options
 */
export async function dispatchScheduled<T = unknown>(
  type: JobType,
  data: T,
  scheduledAt: Date,
  options: Omit<JobOptions, 'delay'> = {}
): Promise<JobResult> {
  const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());
  return dispatch(type, data, { ...options, delay: delayMs });
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a job already exists for an idempotency key
 *
 * @param key - Idempotency key
 * @returns Existing job ID if found, null otherwise
 */
async function checkIdempotency(key: string): Promise<string | null> {
  if (!redis) return null;

  try {
    const existingJobId = await redis.get<string>(idempotencyKey(key));
    return existingJobId;
  } catch (error) {
    console.error('[Queue] Error checking idempotency:', error);
    return null;
  }
}

/**
 * Set idempotency key for a job
 *
 * @param key - Idempotency key
 * @param jobId - Job ID
 */
async function setIdempotency(key: string, jobId: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(idempotencyKey(key), jobId, {
      ex: QUEUE_CONFIG.idempotencyTtl,
    });
  } catch (error) {
    console.error('[Queue] Error setting idempotency:', error);
  }
}

/**
 * Clear idempotency key (for retries or manual reset)
 *
 * @param key - Idempotency key to clear
 */
export async function clearIdempotency(key: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(idempotencyKey(key));
  } catch (error) {
    console.error('[Queue] Error clearing idempotency:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Store job data in Redis
 */
async function storeJob<T>(job: Job<T>): Promise<void> {
  if (!redis) return;

  try {
    // Store job data
    await redis.set(jobKey(job.id), job, {
      ex: QUEUE_CONFIG.defaultJobTtl,
    });

    // Store job status separately for quick lookups
    await redis.set(
      jobStatusKey(job.id),
      {
        status: job.status,
        attempts: job.attempts,
        updatedAt: job.updatedAt,
      },
      { ex: QUEUE_CONFIG.defaultJobTtl }
    );
  } catch (error) {
    console.error('[Queue] Error storing job:', error);
    throw error;
  }
}

/**
 * Get job by ID
 */
export async function getJob<T = unknown>(jobId: string): Promise<Job<T> | null> {
  if (!redis) return null;

  try {
    const job = await redis.get<Job<T>>(jobKey(jobId));
    return job;
  } catch (error) {
    console.error('[Queue] Error getting job:', error);
    return null;
  }
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: Job['status'],
  updates: Partial<Job> = {}
): Promise<void> {
  if (!redis) return;

  try {
    const job = await getJob(jobId);
    if (!job) return;

    const updatedJob: Job = {
      ...job,
      ...updates,
      status,
      updatedAt: new Date(),
    };

    await storeJob(updatedJob);
  } catch (error) {
    console.error('[Queue] Error updating job status:', error);
  }
}

/**
 * Get job status quickly
 */
export async function getJobStatus(jobId: string): Promise<{
  status: Job['status'];
  attempts: number;
  updatedAt: Date;
} | null> {
  if (!redis) return null;

  try {
    const status = await redis.get<{
      status: Job['status'];
      attempts: number;
      updatedAt: Date;
    }>(jobStatusKey(jobId));
    return status;
  } catch (error) {
    console.error('[Queue] Error getting job status:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add job to the appropriate queue
 */
async function addToQueue(
  tier: QueueTier,
  jobId: string,
  score: number
): Promise<void> {
  if (!redis) return;

  try {
    await redis.zadd(queueKey(tier), { score, member: jobId });
  } catch (error) {
    console.error('[Queue] Error adding to queue:', error);
    throw error;
  }
}

/**
 * Calculate priority score for queue ordering
 * Lower score = higher priority (processed first)
 */
function calculatePriorityScore(job: Job, priority?: number): number {
  const now = Date.now();

  // Base score is scheduled time or creation time
  let score = job.scheduledAt?.getTime() || now;

  // Adjust by priority within tier (0-100)
  // Priority 0 = highest, 100 = lowest
  if (priority !== undefined) {
    // Add priority offset (each priority level adds 1 second equivalent)
    score += priority * 1000;
  }

  return score;
}

/**
 * Get queue length for a tier
 */
export async function getQueueLength(tier: QueueTier): Promise<number> {
  if (!redis) return 0;

  try {
    const length = await redis.zcard(queueKey(tier));
    return length;
  } catch (error) {
    console.error('[Queue] Error getting queue length:', error);
    return 0;
  }
}

/**
 * Get queue stats for all tiers
 */
export async function getQueueStats(): Promise<{
  realtime: number;
  background: number;
  batch: number;
  total: number;
}> {
  const [realtime, background, batch] = await Promise.all([
    getQueueLength('realtime'),
    getQueueLength('background'),
    getQueueLength('batch'),
  ]);

  return {
    realtime,
    background,
    batch,
    total: realtime + background + batch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cancel a pending job
 *
 * @param jobId - Job ID to cancel
 * @returns Whether the job was successfully cancelled
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  if (!redis) return false;

  try {
    const job = await getJob(jobId);
    if (!job) return false;

    // Only pending jobs can be cancelled
    if (job.status !== JOB_STATUS.PENDING) {
      return false;
    }

    // Remove from queue
    await redis.zrem(queueKey(job.tier), jobId);

    // Update status
    await updateJobStatus(jobId, JOB_STATUS.FAILED, {
      error: 'Job cancelled',
      completedAt: new Date(),
    });

    // Clear idempotency if set
    if (job.idempotencyKey) {
      await clearIdempotency(job.idempotencyKey);
    }

    return true;
  } catch (error) {
    console.error('[Queue] Error cancelling job:', error);
    return false;
  }
}

/**
 * Retry a failed job
 *
 * @param jobId - Job ID to retry
 * @returns Whether the job was successfully re-queued
 */
export async function retryJob(jobId: string): Promise<boolean> {
  if (!redis) return false;

  try {
    const job = await getJob(jobId);
    if (!job) return false;

    // Only failed/dead jobs can be retried
    if (job.status !== JOB_STATUS.FAILED && job.status !== JOB_STATUS.DEAD) {
      return false;
    }

    // Clear idempotency to allow retry
    if (job.idempotencyKey) {
      await clearIdempotency(job.idempotencyKey);
    }

    // Reset job state
    await updateJobStatus(jobId, JOB_STATUS.PENDING, {
      attempts: 0,
      error: undefined,
      startedAt: undefined,
      completedAt: undefined,
    });

    // Re-add to queue
    const score = Date.now();
    await addToQueue(job.tier, jobId, score);

    // Re-set idempotency
    if (job.idempotencyKey) {
      await setIdempotency(job.idempotencyKey, jobId);
    }

    return true;
  } catch (error) {
    console.error('[Queue] Error retrying job:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE METHODS FOR COMMON JOB TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Dispatch an email job
 */
export async function dispatchEmail(
  data: {
    to: string | string[];
    subject: string;
    body?: string;
    template?: string;
    templateData?: Record<string, unknown>;
  },
  options?: JobOptions
): Promise<JobResult> {
  const type = Array.isArray(data.to) && data.to.length > 1 ? 'email.bulk' : 'email.send';
  return dispatch(type, data, options);
}

/**
 * Dispatch a notification job
 */
export async function dispatchNotification(
  data: {
    userId: string;
    title: string;
    body: string;
    type?: 'push' | 'inApp';
    data?: Record<string, unknown>;
  },
  options?: JobOptions
): Promise<JobResult> {
  const type = data.type === 'push' ? 'notification.push' : 'notification.inApp';
  return dispatch(type, data, options);
}

/**
 * Dispatch a webhook job
 */
export async function dispatchWebhook(
  data: {
    url: string;
    method?: 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    body: unknown;
  },
  options?: JobOptions
): Promise<JobResult> {
  return dispatch('webhook.send', data, options);
}

/**
 * Dispatch a report generation job
 */
export async function dispatchReport(
  data: {
    reportType: string;
    organizationId: string;
    dateRange?: { start: Date; end: Date };
    format?: 'pdf' | 'csv' | 'xlsx';
    email?: string;
  },
  options?: JobOptions
): Promise<JobResult> {
  return dispatch('report.generate', data, {
    ...options,
    organizationId: data.organizationId,
  });
}
