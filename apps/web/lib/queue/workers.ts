/**
 * CampoTech Queue Workers (Phase 5B.1.3 + 5B.3.2)
 * ================================================
 *
 * Worker processors for handling queued jobs.
 *
 * Features:
 * - Tier-specific workers with appropriate concurrency
 * - Automatic retries with exponential backoff
 * - Dead letter queue routing with DLQHandler (Phase 5B.3)
 * - Processing locks to prevent duplicate execution
 * - Job handlers registry
 * - Metrics integration for monitoring
 *
 * Usage:
 * ```typescript
 * import { startWorkers, stopWorkers, registerHandler } from '@/lib/queue/workers';
 *
 * // Register a custom handler
 * registerHandler('custom.job', async (job) => {
 *   // Process job
 *   return { success: true };
 * });
 *
 * // Start workers (typically in a separate process)
 * await startWorkers(['realtime', 'background']);
 *
 * // Stop workers gracefully
 * await stopWorkers();
 * ```
 */

import { redis } from '../cache';
import {
  type Job,
  type JobResult,
  type JobType,
  type QueueTier,
  QUEUE_TIERS,
  QUEUE_CONFIG,
  JOB_STATUS,
  queueKey,
  lockKey,
  dlqKey,
  calculateBackoff,
  isQueueConfigured,
} from './config';
import { getJob, updateJobStatus } from './dispatcher';
import { recordJobCompleted, recordJobEnqueued } from './metrics';

// DLQ Handler is imported dynamically to avoid circular dependencies
let DLQHandler: typeof import('./dlq').DLQHandler | null = null;
async function getDLQHandler() {
  if (!DLQHandler) {
    const dlqModule = await import('./dlq');
    DLQHandler = dlqModule.DLQHandler;
  }
  return DLQHandler;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Job handler function type
 */
export type JobHandler<T = unknown, R = unknown> = (
  job: Job<T>
) => Promise<JobResult<R>>;

/**
 * Worker state
 */
interface WorkerState {
  isRunning: boolean;
  activeJobs: number;
  processedJobs: number;
  failedJobs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registry of job handlers by type
 */
const handlers = new Map<JobType, JobHandler>();

/**
 * Register a job handler
 *
 * @param type - Job type to handle
 * @param handler - Handler function
 */
export function registerHandler<T = unknown, R = unknown>(
  type: JobType,
  handler: JobHandler<T, R>
): void {
  handlers.set(type, handler as JobHandler);

  if (QUEUE_CONFIG.debug) {
    console.log(`[Queue] Registered handler for: ${type}`);
  }
}

/**
 * Get handler for a job type
 */
function getHandler(type: JobType): JobHandler | undefined {
  return handlers.get(type);
}

/**
 * Check if handler exists for a job type
 */
export function hasHandler(type: JobType): boolean {
  return handlers.has(type);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER STATE
// ═══════════════════════════════════════════════════════════════════════════════

const workerState: Record<QueueTier, WorkerState> = {
  realtime: { isRunning: false, activeJobs: 0, processedJobs: 0, failedJobs: 0 },
  background: { isRunning: false, activeJobs: 0, processedJobs: 0, failedJobs: 0 },
  batch: { isRunning: false, activeJobs: 0, processedJobs: 0, failedJobs: 0 },
};

let shutdownRequested = false;

// ═══════════════════════════════════════════════════════════════════════════════
// LOCKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Acquire a processing lock for a job
 */
async function acquireLock(jobId: string): Promise<boolean> {
  if (!redis) return false;

  try {
    // Use SET NX EX for atomic lock acquisition
    const result = await redis.set(lockKey(jobId), Date.now(), {
      nx: true,
      ex: QUEUE_CONFIG.lockTtl,
    });
    return result === 'OK';
  } catch (error) {
    console.error('[Queue] Error acquiring lock:', error);
    return false;
  }
}

/**
 * Release a processing lock
 */
async function releaseLock(jobId: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(lockKey(jobId));
  } catch (error) {
    console.error('[Queue] Error releasing lock:', error);
  }
}

/**
 * Extend lock TTL (for long-running jobs)
 */
async function extendLock(jobId: string): Promise<boolean> {
  if (!redis) return false;

  try {
    const result = await redis.expire(lockKey(jobId), QUEUE_CONFIG.lockTtl);
    return result === 1;
  } catch (error) {
    console.error('[Queue] Error extending lock:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process a single job
 */
async function processJob(job: Job): Promise<JobResult> {
  const startTime = Date.now();
  const handler = getHandler(job.type);

  if (!handler) {
    console.error(`[Queue] No handler registered for job type: ${job.type}`);
    return {
      success: false,
      jobId: job.id,
      error: `No handler for job type: ${job.type}`,
    };
  }

  try {
    // Update status to processing
    await updateJobStatus(job.id, JOB_STATUS.PROCESSING, {
      startedAt: new Date(),
      attempts: job.attempts + 1,
    });

    // Execute handler with timeout
    const tierConfig = QUEUE_TIERS[job.tier];
    const result = await executeWithTimeout(
      () => handler(job),
      tierConfig.timeout
    );

    const duration = Date.now() - startTime;

    if (result.success) {
      // Job completed successfully
      await updateJobStatus(job.id, JOB_STATUS.COMPLETED, {
        completedAt: new Date(),
        result: result.data,
      });

      // Record metrics (Phase 5B.2)
      await recordJobCompleted(job.tier, job.type, duration, true);

      if (QUEUE_CONFIG.debug) {
        console.log(`[Queue] Job completed: ${job.id} in ${duration}ms`);
      }
    } else {
      // Handler returned failure
      throw new Error(result.error || 'Handler returned failure');
    }

    return {
      ...result,
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;

    console.error(`[Queue] Job failed: ${job.id}`, error);

    // Record failure metrics (Phase 5B.2)
    await recordJobCompleted(job.tier, job.type, duration, false);

    // Check if we should retry
    const tierConfig = QUEUE_TIERS[job.tier];
    const currentAttempt = job.attempts + 1;

    if (currentAttempt < job.maxRetries) {
      // Schedule retry with exponential backoff
      const retryDelay = calculateBackoff(currentAttempt, tierConfig.retryDelayMs);

      await updateJobStatus(job.id, JOB_STATUS.RETRYING, {
        error: errorMessage,
        attempts: currentAttempt,
      });

      // Re-add to queue with delay
      if (redis) {
        const retryScore = Date.now() + retryDelay;
        await redis.zadd(queueKey(job.tier), { score: retryScore, member: job.id });
      }

      if (QUEUE_CONFIG.debug) {
        console.log(`[Queue] Job ${job.id} scheduled for retry in ${retryDelay}ms (attempt ${currentAttempt + 1}/${job.maxRetries})`);
      }
    } else {
      // Move to dead letter queue using DLQ handler (Phase 5B.3)
      const dlq = await getDLQHandler();
      await dlq.moveToDeadLetter(job, errorMessage);
    }

    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
      duration,
    };
  }
}

/**
 * Execute function with timeout
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Job timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER LOOP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start a worker for a specific tier
 */
async function startTierWorker(tier: QueueTier): Promise<void> {
  const tierConfig = QUEUE_TIERS[tier];
  const state = workerState[tier];

  if (state.isRunning) {
    console.log(`[Queue] Worker for ${tier} is already running`);
    return;
  }

  state.isRunning = true;
  console.log(`[Queue] Starting ${tier} worker (concurrency: ${tierConfig.concurrency})`);

  while (state.isRunning && !shutdownRequested) {
    try {
      // Check if we have capacity
      if (state.activeJobs >= tierConfig.concurrency) {
        await sleep(100);
        continue;
      }

      // Fetch next jobs from queue
      const jobIds = await fetchJobs(tier, tierConfig.concurrency - state.activeJobs);

      if (jobIds.length === 0) {
        // No jobs available, wait before polling again
        await sleep(QUEUE_CONFIG.pollInterval);
        continue;
      }

      // Process jobs concurrently
      for (const jobId of jobIds) {
        // Don't start new jobs if shutdown requested
        if (shutdownRequested) break;

        // Try to acquire lock
        const locked = await acquireLock(jobId);
        if (!locked) continue;

        // Get job data
        const job = await getJob(jobId);
        if (!job) {
          await releaseLock(jobId);
          continue;
        }

        // Check if job is ready to process (scheduled time)
        if (job.scheduledAt && job.scheduledAt.getTime() > Date.now()) {
          await releaseLock(jobId);
          continue;
        }

        // Process job in background
        state.activeJobs++;
        processJob(job)
          .then((result) => {
            if (result.success) {
              state.processedJobs++;
            } else {
              state.failedJobs++;
            }
          })
          .catch((error) => {
            console.error(`[Queue] Unhandled error processing job ${jobId}:`, error);
            state.failedJobs++;
          })
          .finally(async () => {
            state.activeJobs--;
            await releaseLock(jobId);
          });
      }
    } catch (error) {
      console.error(`[Queue] Error in ${tier} worker loop:`, error);
      await sleep(QUEUE_CONFIG.pollInterval);
    }
  }

  console.log(`[Queue] ${tier} worker stopped`);
}

/**
 * Fetch jobs from queue
 */
async function fetchJobs(tier: QueueTier, count: number): Promise<string[]> {
  if (!redis) return [];

  try {
    const now = Date.now();

    // Get jobs with score <= now (ready to process)
    // Using zrange with BYSCORE (Upstash Redis REST API)
    const jobs = await redis.zrange(queueKey(tier), 0, now, {
      byScore: true,
      offset: 0,
      count: Math.min(count, QUEUE_CONFIG.batchSize),
    }) as string[];

    // Remove fetched jobs from queue
    if (jobs.length > 0) {
      await redis.zrem(queueKey(tier), ...jobs);
    }

    return jobs;
  } catch (error) {
    console.error('[Queue] Error fetching jobs:', error);
    return [];
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC WORKER CONTROL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start workers for specified tiers
 *
 * @param tiers - Tiers to start workers for (defaults to all)
 */
export async function startWorkers(tiers?: QueueTier[]): Promise<void> {
  if (!isQueueConfigured()) {
    console.warn('[Queue] Queue not configured - workers not started');
    return;
  }

  shutdownRequested = false;
  const tiersToStart = tiers || (['realtime', 'background', 'batch'] as QueueTier[]);

  console.log(`[Queue] Starting workers for tiers: ${tiersToStart.join(', ')}`);

  // Start workers concurrently
  await Promise.all(tiersToStart.map((tier) => startTierWorker(tier)));
}

/**
 * Stop all workers gracefully
 */
export async function stopWorkers(): Promise<void> {
  console.log('[Queue] Stopping workers...');
  shutdownRequested = true;

  // Stop all tier workers
  for (const tier of ['realtime', 'background', 'batch'] as QueueTier[]) {
    workerState[tier].isRunning = false;
  }

  // Wait for active jobs to complete (max 30 seconds)
  const maxWait = 30000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const totalActive = Object.values(workerState).reduce(
      (sum, state) => sum + state.activeJobs,
      0
    );

    if (totalActive === 0) {
      console.log('[Queue] All workers stopped gracefully');
      return;
    }

    await sleep(100);
  }

  console.warn('[Queue] Some jobs still active after timeout');
}

/**
 * Get worker statistics
 */
export function getWorkerStats(): Record<QueueTier, WorkerState> {
  return { ...workerState };
}

/**
 * Check if workers are running
 */
export function isWorkersRunning(): boolean {
  return Object.values(workerState).some((state) => state.isRunning);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEAD LETTER QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get jobs in dead letter queue
 */
export async function getDeadLetterJobs(
  tier: QueueTier,
  limit: number = 100
): Promise<Job[]> {
  if (!redis) return [];

  try {
    const jobIds = await redis.zrange(dlqKey(tier), 0, limit - 1) as string[];
    const jobs = await Promise.all(jobIds.map((id: string) => getJob(id)));
    return jobs.filter((job: Job | null): job is Job => job !== null);
  } catch (error) {
    console.error('[Queue] Error getting DLQ jobs:', error);
    return [];
  }
}

/**
 * Retry all jobs in dead letter queue
 */
export async function retryDeadLetterQueue(tier: QueueTier): Promise<number> {
  if (!redis) return 0;

  try {
    const jobIds = await redis.zrange(dlqKey(tier), 0, -1) as string[];
    let retried = 0;

    for (const jobId of jobIds) {
      const job = await getJob(jobId);
      if (!job) continue;

      // Reset job state and re-queue
      await updateJobStatus(jobId, JOB_STATUS.PENDING, {
        attempts: 0,
        error: undefined,
        startedAt: undefined,
        completedAt: undefined,
      });

      await redis.zadd(queueKey(tier), { score: Date.now(), member: jobId });
      await redis.zrem(dlqKey(tier), jobId);
      retried++;
    }

    console.log(`[Queue] Retried ${retried} jobs from ${tier} DLQ`);
    return retried;
  } catch (error) {
    console.error('[Queue] Error retrying DLQ:', error);
    return 0;
  }
}

/**
 * Clear dead letter queue
 */
export async function clearDeadLetterQueue(tier: QueueTier): Promise<number> {
  if (!redis) return 0;

  try {
    const count = await redis.zcard(dlqKey(tier));
    await redis.del(dlqKey(tier));
    console.log(`[Queue] Cleared ${count} jobs from ${tier} DLQ`);
    return count;
  } catch (error) {
    console.error('[Queue] Error clearing DLQ:', error);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILT-IN HANDLERS (STUBS)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register default handlers
 * These are placeholder implementations - replace with actual logic
 */
export function registerDefaultHandlers(): void {
  // Email handler (stub)
  registerHandler('email.send', async (job) => {
    const data = job.data as { to: string; subject: string; body?: string };
    console.log(`[Email] Would send to ${data.to}: ${data.subject}`);
    // TODO: Integrate with email service (Resend, SendGrid, etc.)
    return { success: true, jobId: job.id, data: { sent: true } };
  });

  // Bulk email handler (stub)
  registerHandler('email.bulk', async (job) => {
    const data = job.data as { to: string[]; subject: string };
    console.log(`[Email] Would send bulk to ${data.to.length} recipients`);
    return { success: true, jobId: job.id, data: { sent: data.to.length } };
  });

  // Push notification handler (stub)
  registerHandler('notification.push', async (job) => {
    const data = job.data as { userId: string; title: string };
    console.log(`[Notification] Would push to ${data.userId}: ${data.title}`);
    // TODO: Integrate with push service (Firebase, OneSignal, etc.)
    return { success: true, jobId: job.id };
  });

  // In-app notification handler (stub)
  registerHandler('notification.inApp', async (job) => {
    const data = job.data as { userId: string; title: string };
    console.log(`[Notification] Would create in-app for ${data.userId}: ${data.title}`);
    // TODO: Store notification in database
    return { success: true, jobId: job.id };
  });

  // Webhook handler (stub)
  registerHandler('webhook.send', async (job) => {
    const data = job.data as { url: string; method?: string; body: unknown };
    console.log(`[Webhook] Would send ${data.method || 'POST'} to ${data.url}`);
    // TODO: Implement actual HTTP request
    return { success: true, jobId: job.id };
  });

  // Report generation handler (stub)
  registerHandler('report.generate', async (job) => {
    const data = job.data as { reportType: string; organizationId: string };
    console.log(`[Report] Would generate ${data.reportType} for org ${data.organizationId}`);
    // TODO: Implement report generation
    return { success: true, jobId: job.id, data: { reportUrl: '' } };
  });

  // Data archival handler (stub)
  registerHandler('data.archive', async (job) => {
    const data = job.data as { type: string; olderThan: Date };
    console.log(`[Archive] Would archive ${data.type} older than ${data.olderThan}`);
    // TODO: Integrate with data archiver
    return { success: true, jobId: job.id };
  });

  // Cache invalidation handler
  registerHandler('cache.invalidate', async (job) => {
    const data = job.data as { keys?: string[]; pattern?: string };
    console.log(`[Cache] Invalidating cache: ${data.keys?.join(', ') || data.pattern}`);
    // TODO: Integrate with cache module
    return { success: true, jobId: job.id };
  });

  console.log('[Queue] Default handlers registered');
}
