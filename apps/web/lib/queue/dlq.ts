/**
 * CampoTech Dead Letter Queue Handler (Phase 5B.3.1)
 * ====================================================
 *
 * Comprehensive DLQ management for permanently failed jobs.
 *
 * Features:
 * - Configurable DLQ policies per tier and job type
 * - Error pattern analysis for debugging
 * - Alerting hooks for critical failures
 * - Automatic cleanup based on retention
 * - Reprocessing strategies (immediate, delayed, manual)
 * - DLQ metrics and statistics
 *
 * Usage:
 * ```typescript
 * import { DLQHandler, getDlqStats, analyzeDlqErrors } from '@/lib/queue/dlq';
 *
 * // Configure DLQ behavior
 * DLQHandler.configure({
 *   onJobDead: async (job) => {
 *     // Send alert, log to external service, etc.
 *     await sendSlackAlert(`Job ${job.id} failed permanently`);
 *   },
 * });
 *
 * // Get DLQ statistics
 * const stats = await getDlqStats();
 * console.log(`${stats.total} jobs in DLQ`);
 *
 * // Analyze error patterns
 * const errors = await analyzeDlqErrors('background');
 * console.log(`Top error: ${errors[0].message} (${errors[0].count} occurrences)`);
 * ```
 */

import { redis } from '../cache';
import {
  type Job,
  type JobType,
  type QueueTier,
  JOB_STATUS,
  dlqKey,
  jobKey,
} from './config';
import { getJob, updateJobStatus } from './dispatcher';
import { recordJobFailed } from './metrics';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DLQ job entry with metadata
 */
export interface DLQEntry {
  job: Job;
  failedAt: Date;
  originalTier: QueueTier;
  errorCategory: ErrorCategory;
  retryable: boolean;
  suggestedAction: DLQAction;
}

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'timeout'
  | 'validation'
  | 'external_service'
  | 'rate_limit'
  | 'auth'
  | 'not_found'
  | 'conflict'
  | 'internal'
  | 'unknown';

/**
 * Suggested actions for DLQ entries
 */
export type DLQAction =
  | 'retry_immediately'
  | 'retry_with_delay'
  | 'manual_intervention'
  | 'discard'
  | 'escalate';

/**
 * DLQ policy configuration
 */
export interface DLQPolicy {
  /** Maximum time to keep jobs in DLQ (seconds) */
  retentionSeconds: number;

  /** Maximum number of jobs to keep in DLQ per tier */
  maxJobsPerTier: number;

  /** Whether to automatically retry certain error types */
  autoRetryCategories: ErrorCategory[];

  /** Delay before auto-retry (milliseconds) */
  autoRetryDelayMs: number;

  /** Maximum auto-retries from DLQ */
  maxAutoRetries: number;
}

/**
 * DLQ statistics
 */
export interface DLQStats {
  total: number;
  byTier: Record<QueueTier, number>;
  byJobType: Record<string, number>;
  byErrorCategory: Record<ErrorCategory, number>;
  oldestJobAge: number | null; // seconds
  newestJobAge: number | null; // seconds
  retryableCount: number;
}

/**
 * Error pattern analysis result
 */
export interface ErrorPattern {
  message: string;
  count: number;
  category: ErrorCategory;
  jobTypes: string[];
  firstSeen: Date;
  lastSeen: Date;
  suggestedFix: string;
}

/**
 * DLQ event handlers
 */
export interface DLQEventHandlers {
  /** Called when a job is moved to DLQ */
  onJobDead?: (job: Job, error: string) => Promise<void>;

  /** Called when DLQ threshold is exceeded */
  onThresholdExceeded?: (tier: QueueTier, count: number) => Promise<void>;

  /** Called when a critical job type fails */
  onCriticalFailure?: (job: Job, error: string) => Promise<void>;

  /** Called on successful DLQ cleanup */
  onCleanup?: (tier: QueueTier, removedCount: number) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_POLICY: DLQPolicy = {
  retentionSeconds: 7 * 24 * 60 * 60, // 7 days
  maxJobsPerTier: 10000,
  autoRetryCategories: ['timeout', 'rate_limit', 'external_service'],
  autoRetryDelayMs: 300000, // 5 minutes
  maxAutoRetries: 2,
};

/** Job types considered critical (require immediate attention) */
const CRITICAL_JOB_TYPES: JobType[] = [
  'invoice.generate',
  'billing.process',
  'webhook.send',
];

/** DLQ alert thresholds per tier */
const DLQ_THRESHOLDS: Record<QueueTier, number> = {
  realtime: 10,
  background: 50,
  batch: 100,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DLQ HANDLER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Dead Letter Queue Handler
 *
 * Manages permanently failed jobs with configurable policies and alerting.
 */
class DLQHandlerClass {
  private policy: DLQPolicy = DEFAULT_POLICY;
  private handlers: DLQEventHandlers = {};
  private dlqRetryCount = new Map<string, number>();

  /**
   * Configure DLQ behavior
   */
  configure(options: Partial<DLQPolicy> & DLQEventHandlers): void {
    if (options.retentionSeconds !== undefined) {
      this.policy.retentionSeconds = options.retentionSeconds;
    }
    if (options.maxJobsPerTier !== undefined) {
      this.policy.maxJobsPerTier = options.maxJobsPerTier;
    }
    if (options.autoRetryCategories !== undefined) {
      this.policy.autoRetryCategories = options.autoRetryCategories;
    }
    if (options.autoRetryDelayMs !== undefined) {
      this.policy.autoRetryDelayMs = options.autoRetryDelayMs;
    }
    if (options.maxAutoRetries !== undefined) {
      this.policy.maxAutoRetries = options.maxAutoRetries;
    }

    // Event handlers
    if (options.onJobDead) this.handlers.onJobDead = options.onJobDead;
    if (options.onThresholdExceeded) this.handlers.onThresholdExceeded = options.onThresholdExceeded;
    if (options.onCriticalFailure) this.handlers.onCriticalFailure = options.onCriticalFailure;
    if (options.onCleanup) this.handlers.onCleanup = options.onCleanup;

    console.log('[DLQ] Handler configured with custom policy');
  }

  /**
   * Move a job to the dead letter queue
   */
  async moveToDeadLetter(job: Job, error: string): Promise<void> {
    if (!redis) return;

    const category = this.categorizeError(error);
    const isCritical = CRITICAL_JOB_TYPES.includes(job.type);

    try {
      // Update job status
      await updateJobStatus(job.id, JOB_STATUS.DEAD, {
        error,
        completedAt: new Date(),
      });

      // Store additional DLQ metadata
      const dlqMetadata = {
        errorCategory: category,
        failedAt: Date.now(),
        originalAttempts: job.attempts,
        dlqRetries: 0,
      };
      await redis.set(`dlq:meta:${job.id}`, dlqMetadata, {
        ex: this.policy.retentionSeconds,
      });

      // Add to DLQ sorted set (score = timestamp for ordering)
      await redis.zadd(dlqKey(job.tier), { score: Date.now(), member: job.id });

      // Record metrics
      await recordJobFailed(job.tier, job.type, error);

      console.warn(
        `[DLQ] Job ${job.id} (${job.type}) moved to DLQ: ${error.substring(0, 100)}`
      );

      // Fire event handlers
      await this.handleJobDead(job, error, category, isCritical);

      // Check thresholds
      await this.checkThresholds(job.tier);

      // Consider auto-retry
      if (this.shouldAutoRetry(category, job.id)) {
        await this.scheduleAutoRetry(job);
      }
    } catch (err) {
      console.error('[DLQ] Error moving job to DLQ:', err);
    }
  }

  /**
   * Categorize error message into a category
   */
  private categorizeError(error: string): ErrorCategory {
    const errorLower = error.toLowerCase();

    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return 'timeout';
    }
    if (errorLower.includes('validation') || errorLower.includes('invalid')) {
      return 'validation';
    }
    if (
      errorLower.includes('rate limit') ||
      errorLower.includes('too many requests') ||
      errorLower.includes('429')
    ) {
      return 'rate_limit';
    }
    if (
      errorLower.includes('unauthorized') ||
      errorLower.includes('forbidden') ||
      errorLower.includes('401') ||
      errorLower.includes('403')
    ) {
      return 'auth';
    }
    if (errorLower.includes('not found') || errorLower.includes('404')) {
      return 'not_found';
    }
    if (errorLower.includes('conflict') || errorLower.includes('409')) {
      return 'conflict';
    }
    if (
      errorLower.includes('econnrefused') ||
      errorLower.includes('enotfound') ||
      errorLower.includes('network') ||
      errorLower.includes('external')
    ) {
      return 'external_service';
    }
    if (
      errorLower.includes('internal') ||
      errorLower.includes('500') ||
      errorLower.includes('exception')
    ) {
      return 'internal';
    }

    return 'unknown';
  }

  /**
   * Determine suggested action for a DLQ entry
   */
  getSuggestedAction(category: ErrorCategory, job: Job): DLQAction {
    switch (category) {
      case 'timeout':
      case 'rate_limit':
        return 'retry_with_delay';

      case 'external_service':
        return 'retry_with_delay';

      case 'validation':
      case 'not_found':
        return 'manual_intervention';

      case 'auth':
        return 'escalate';

      case 'conflict':
        return 'discard';

      case 'internal':
        if (CRITICAL_JOB_TYPES.includes(job.type)) {
          return 'escalate';
        }
        return 'manual_intervention';

      default:
        return 'manual_intervention';
    }
  }

  /**
   * Check if error category is retryable
   */
  isRetryable(category: ErrorCategory): boolean {
    return ['timeout', 'rate_limit', 'external_service'].includes(category);
  }

  /**
   * Fire event handlers for dead job
   */
  private async handleJobDead(
    job: Job,
    error: string,
    category: ErrorCategory,
    isCritical: boolean
  ): Promise<void> {
    try {
      if (this.handlers.onJobDead) {
        await this.handlers.onJobDead(job, error);
      }

      if (isCritical && this.handlers.onCriticalFailure) {
        await this.handlers.onCriticalFailure(job, error);
      }
    } catch (err) {
      console.error('[DLQ] Error in event handler:', err);
    }
  }

  /**
   * Check if DLQ threshold exceeded and fire alert
   */
  private async checkThresholds(tier: QueueTier): Promise<void> {
    if (!redis) return;

    try {
      const count = await redis.zcard(dlqKey(tier));
      const threshold = DLQ_THRESHOLDS[tier];

      if (count >= threshold && this.handlers.onThresholdExceeded) {
        await this.handlers.onThresholdExceeded(tier, count);
      }
    } catch (err) {
      console.error('[DLQ] Error checking thresholds:', err);
    }
  }

  /**
   * Check if job should be auto-retried
   */
  private shouldAutoRetry(category: ErrorCategory, jobId: string): boolean {
    if (!this.policy.autoRetryCategories.includes(category)) {
      return false;
    }

    const currentRetries = this.dlqRetryCount.get(jobId) || 0;
    return currentRetries < this.policy.maxAutoRetries;
  }

  /**
   * Schedule auto-retry for a job
   */
  private async scheduleAutoRetry(job: Job): Promise<void> {
    if (!redis) return;

    const currentRetries = this.dlqRetryCount.get(job.id) || 0;
    this.dlqRetryCount.set(job.id, currentRetries + 1);

    console.log(
      `[DLQ] Scheduling auto-retry for ${job.id} in ${this.policy.autoRetryDelayMs}ms`
    );

    // In a real implementation, this would use a delayed queue
    // For now, we'll store the retry time in metadata
    await redis.set(
      `dlq:autoretry:${job.id}`,
      {
        retryAt: Date.now() + this.policy.autoRetryDelayMs,
        attempt: currentRetries + 1,
      },
      { ex: Math.ceil(this.policy.autoRetryDelayMs / 1000) + 60 }
    );
  }

  /**
   * Get DLQ entry with metadata
   */
  async getEntry(jobId: string): Promise<DLQEntry | null> {
    if (!redis) return null;

    try {
      const [job, metadata] = await Promise.all([
        getJob(jobId),
        redis.get<{ errorCategory: ErrorCategory; failedAt: number }>(`dlq:meta:${jobId}`),
      ]);

      if (!job) return null;

      const category = metadata?.errorCategory || 'unknown';

      return {
        job,
        failedAt: new Date(metadata?.failedAt || Date.now()),
        originalTier: job.tier,
        errorCategory: category,
        retryable: this.isRetryable(category),
        suggestedAction: this.getSuggestedAction(category, job),
      };
    } catch (err) {
      console.error('[DLQ] Error getting entry:', err);
      return null;
    }
  }

  /**
   * Get all entries for a tier
   */
  async getEntries(tier: QueueTier, limit = 100): Promise<DLQEntry[]> {
    if (!redis) return [];

    try {
      const jobIds = (await redis.zrange(dlqKey(tier), 0, limit - 1)) as string[];
      const entries = await Promise.all(
        jobIds.map((id: string) => this.getEntry(id))
      );
      return entries.filter((e: DLQEntry | null): e is DLQEntry => e !== null);
    } catch (err) {
      console.error('[DLQ] Error getting entries:', err);
      return [];
    }
  }

  /**
   * Retry a specific job from DLQ
   */
  async retryJob(jobId: string, options?: { delay?: number }): Promise<boolean> {
    if (!redis) return false;

    try {
      const entry = await this.getEntry(jobId);
      if (!entry) return false;

      const { job } = entry;

      // Remove from DLQ
      await redis.zrem(dlqKey(job.tier), jobId);

      // Reset job state
      await updateJobStatus(jobId, JOB_STATUS.PENDING, {
        attempts: 0,
        error: undefined,
        startedAt: undefined,
        completedAt: undefined,
      });

      // Re-add to queue (with optional delay)
      const score = options?.delay ? Date.now() + options.delay : Date.now();
      await redis.zadd(`queue:${job.tier}`, { score, member: jobId });

      // Clear DLQ metadata
      await redis.del(`dlq:meta:${jobId}`);
      this.dlqRetryCount.delete(jobId);

      console.log(`[DLQ] Job ${jobId} moved back to ${job.tier} queue`);
      return true;
    } catch (err) {
      console.error('[DLQ] Error retrying job:', err);
      return false;
    }
  }

  /**
   * Retry all jobs in a tier's DLQ
   */
  async retryAll(tier: QueueTier, options?: { delay?: number }): Promise<number> {
    if (!redis) return 0;

    try {
      const jobIds = (await redis.zrange(dlqKey(tier), 0, -1)) as string[];
      let retried = 0;

      for (const jobId of jobIds) {
        if (await this.retryJob(jobId, options)) {
          retried++;
        }
      }

      console.log(`[DLQ] Retried ${retried} jobs from ${tier} DLQ`);
      return retried;
    } catch (err) {
      console.error('[DLQ] Error retrying all:', err);
      return 0;
    }
  }

  /**
   * Retry jobs matching specific criteria
   */
  async retryMatching(
    tier: QueueTier,
    criteria: {
      jobTypes?: JobType[];
      errorCategories?: ErrorCategory[];
      maxAge?: number; // seconds
    }
  ): Promise<number> {
    if (!redis) return 0;

    try {
      const entries = await this.getEntries(tier, 1000);
      const now = Date.now();
      let retried = 0;

      for (const entry of entries) {
        const matchesType =
          !criteria.jobTypes || criteria.jobTypes.includes(entry.job.type);
        const matchesCategory =
          !criteria.errorCategories ||
          criteria.errorCategories.includes(entry.errorCategory);
        const matchesAge =
          !criteria.maxAge ||
          (now - entry.failedAt.getTime()) / 1000 <= criteria.maxAge;

        if (matchesType && matchesCategory && matchesAge) {
          if (await this.retryJob(entry.job.id)) {
            retried++;
          }
        }
      }

      console.log(`[DLQ] Retried ${retried} matching jobs from ${tier} DLQ`);
      return retried;
    } catch (err) {
      console.error('[DLQ] Error retrying matching:', err);
      return 0;
    }
  }

  /**
   * Discard a job from DLQ
   */
  async discardJob(jobId: string): Promise<boolean> {
    if (!redis) return false;

    try {
      const job = await getJob(jobId);
      if (!job) return false;

      // Remove from DLQ
      await redis.zrem(dlqKey(job.tier), jobId);

      // Clean up all job data
      await Promise.all([
        redis.del(jobKey(jobId)),
        redis.del(`job:status:${jobId}`),
        redis.del(`dlq:meta:${jobId}`),
      ]);

      this.dlqRetryCount.delete(jobId);

      console.log(`[DLQ] Job ${jobId} discarded`);
      return true;
    } catch (err) {
      console.error('[DLQ] Error discarding job:', err);
      return false;
    }
  }

  /**
   * Clean up old DLQ entries based on retention policy
   */
  async cleanup(tier: QueueTier): Promise<number> {
    if (!redis) return 0;

    try {
      const cutoff = Date.now() - this.policy.retentionSeconds * 1000;

      // Remove entries older than retention period
      const removed = await redis.zremrangebyscore(dlqKey(tier), 0, cutoff);

      if (removed > 0) {
        console.log(`[DLQ] Cleaned up ${removed} expired entries from ${tier} DLQ`);

        if (this.handlers.onCleanup) {
          await this.handlers.onCleanup(tier, removed);
        }
      }

      // Trim to max size
      const count = await redis.zcard(dlqKey(tier));
      if (count > this.policy.maxJobsPerTier) {
        const excess = count - this.policy.maxJobsPerTier;
        await redis.zremrangebyrank(dlqKey(tier), 0, excess - 1);
        console.log(`[DLQ] Trimmed ${excess} excess entries from ${tier} DLQ`);
      }

      return removed;
    } catch (err) {
      console.error('[DLQ] Error during cleanup:', err);
      return 0;
    }
  }

  /**
   * Clean up all tiers
   */
  async cleanupAll(): Promise<Record<QueueTier, number>> {
    const results: Record<QueueTier, number> = {
      realtime: 0,
      background: 0,
      batch: 0,
    };

    for (const tier of ['realtime', 'background', 'batch'] as QueueTier[]) {
      results[tier] = await this.cleanup(tier);
    }

    return results;
  }

  /**
   * Get policy configuration
   */
  getPolicy(): DLQPolicy {
    return { ...this.policy };
  }
}

// Singleton instance
export const DLQHandler = new DLQHandlerClass();

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS AND ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get DLQ statistics across all tiers
 */
export async function getDlqStats(): Promise<DLQStats> {
  if (!redis) {
    return {
      total: 0,
      byTier: { realtime: 0, background: 0, batch: 0 },
      byJobType: {},
      byErrorCategory: {} as Record<ErrorCategory, number>,
      oldestJobAge: null,
      newestJobAge: null,
      retryableCount: 0,
    };
  }

  const tiers: QueueTier[] = ['realtime', 'background', 'batch'];
  const byTier: Record<QueueTier, number> = { realtime: 0, background: 0, batch: 0 };
  const byJobType: Record<string, number> = {};
  const byErrorCategory: Record<ErrorCategory, number> = {
    timeout: 0,
    validation: 0,
    external_service: 0,
    rate_limit: 0,
    auth: 0,
    not_found: 0,
    conflict: 0,
    internal: 0,
    unknown: 0,
  };

  let oldestTimestamp: number | null = null;
  let newestTimestamp: number | null = null;
  let retryableCount = 0;
  let total = 0;

  try {
    for (const tier of tiers) {
      const entries = await DLQHandler.getEntries(tier, 500);
      byTier[tier] = entries.length;
      total += entries.length;

      for (const entry of entries) {
        // Count by job type
        byJobType[entry.job.type] = (byJobType[entry.job.type] || 0) + 1;

        // Count by error category
        byErrorCategory[entry.errorCategory]++;

        // Track retryable
        if (entry.retryable) retryableCount++;

        // Track timestamps
        const ts = entry.failedAt.getTime();
        if (oldestTimestamp === null || ts < oldestTimestamp) {
          oldestTimestamp = ts;
        }
        if (newestTimestamp === null || ts > newestTimestamp) {
          newestTimestamp = ts;
        }
      }
    }

    const now = Date.now();
    return {
      total,
      byTier,
      byJobType,
      byErrorCategory,
      oldestJobAge: oldestTimestamp ? Math.round((now - oldestTimestamp) / 1000) : null,
      newestJobAge: newestTimestamp ? Math.round((now - newestTimestamp) / 1000) : null,
      retryableCount,
    };
  } catch (err) {
    console.error('[DLQ] Error getting stats:', err);
    return {
      total: 0,
      byTier,
      byJobType: {},
      byErrorCategory,
      oldestJobAge: null,
      newestJobAge: null,
      retryableCount: 0,
    };
  }
}

/**
 * Analyze error patterns in DLQ
 */
export async function analyzeDlqErrors(tier: QueueTier): Promise<ErrorPattern[]> {
  const entries = await DLQHandler.getEntries(tier, 500);
  const patterns = new Map<
    string,
    {
      count: number;
      category: ErrorCategory;
      jobTypes: Set<string>;
      firstSeen: Date;
      lastSeen: Date;
    }
  >();

  for (const entry of entries) {
    const error = entry.job.error || 'Unknown error';
    // Normalize error message (remove IDs, timestamps, etc.)
    const normalizedError = normalizeErrorMessage(error);

    const existing = patterns.get(normalizedError);
    if (existing) {
      existing.count++;
      existing.jobTypes.add(entry.job.type);
      if (entry.failedAt < existing.firstSeen) {
        existing.firstSeen = entry.failedAt;
      }
      if (entry.failedAt > existing.lastSeen) {
        existing.lastSeen = entry.failedAt;
      }
    } else {
      patterns.set(normalizedError, {
        count: 1,
        category: entry.errorCategory,
        jobTypes: new Set([entry.job.type]),
        firstSeen: entry.failedAt,
        lastSeen: entry.failedAt,
      });
    }
  }

  // Convert to array and sort by count
  const result: ErrorPattern[] = [];
  for (const [message, data] of patterns.entries()) {
    result.push({
      message,
      count: data.count,
      category: data.category,
      jobTypes: Array.from(data.jobTypes),
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen,
      suggestedFix: getSuggestedFix(data.category, message),
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

/**
 * Normalize error message for pattern matching
 */
function normalizeErrorMessage(error: string): string {
  return error
    // Remove UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    // Remove timestamps
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '<TIMESTAMP>')
    // Remove numbers
    .replace(/\d+/g, '<N>')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

/**
 * Get suggested fix for error category
 */
function getSuggestedFix(category: ErrorCategory, _message: string): string {
  switch (category) {
    case 'timeout':
      return 'Consider increasing timeout limits or optimizing the job processing logic';

    case 'rate_limit':
      return 'Implement rate limiting on the ADMIN or increase delay between retries';

    case 'external_service':
      return 'Check external service health. Consider implementing circuit breaker pattern';

    case 'auth':
      return 'Verify API credentials and token refresh logic';

    case 'validation':
      return 'Review input validation in the ADMIN. Check for missing required fields';

    case 'not_found':
      return 'Resource may have been deleted. Consider adding existence checks before processing';

    case 'conflict':
      return 'Implement idempotency keys or check for duplicate processing';

    case 'internal':
      return 'Review application logs for stack traces. May require code fix';

    default:
      return 'Review error details and application logs for more context';
  }
}

/**
 * Get DLQ health summary
 */
export async function getDlqHealth(): Promise<{
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
}> {
  const stats = await getDlqStats();
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check total count
  if (stats.total > 1000) {
    issues.push(`High DLQ volume: ${stats.total} jobs`);
    recommendations.push('Consider running bulk cleanup or retry operations');
  }

  // Check by tier
  for (const tier of ['realtime', 'background', 'batch'] as QueueTier[]) {
    if (stats.byTier[tier] > DLQ_THRESHOLDS[tier]) {
      issues.push(`${tier} DLQ exceeds threshold: ${stats.byTier[tier]} jobs`);
    }
  }

  // Check for stale jobs
  if (stats.oldestJobAge && stats.oldestJobAge > 24 * 60 * 60) {
    const days = Math.floor(stats.oldestJobAge / (24 * 60 * 60));
    issues.push(`Oldest job is ${days} days old`);
    recommendations.push('Run cleanup to remove expired entries');
  }

  // Check retryable percentage
  if (stats.total > 0) {
    const retryablePercent = (stats.retryableCount / stats.total) * 100;
    if (retryablePercent > 50) {
      recommendations.push(
        `${retryablePercent.toFixed(0)}% of DLQ jobs are retryable. Consider auto-retry`
      );
    }
  }

  // Determine status
  let status: 'healthy' | 'warning' | 'critical';
  if (issues.length === 0) {
    status = 'healthy';
  } else if (issues.length <= 2) {
    status = 'warning';
  } else {
    status = 'critical';
  }

  return { status, issues, recommendations };
}
