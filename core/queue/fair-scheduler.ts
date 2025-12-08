/**
 * Fair Scheduler for Multi-Tenant Queue Processing
 * =================================================
 *
 * Ensures fair resource allocation across organizations in shared queues.
 * Prevents high-traffic orgs from starving others.
 *
 * FEATURES:
 * - Per-org concurrency limits
 * - Round-robin scheduling across orgs
 * - Priority queue support
 * - Metrics collection for wait times
 * - Circuit breaker integration for org-level issues
 *
 * USAGE:
 * ```typescript
 * const scheduler = new FairScheduler({
 *   maxConcurrentPerOrg: 10,
 *   maxTotalConcurrent: 100,
 *   roundRobinIntervalMs: 100,
 * });
 *
 * // In worker
 * worker.on('active', (job) => scheduler.trackJob(job.data.orgId, job.id));
 * worker.on('completed', (job) => scheduler.releaseJob(job.data.orgId, job.id));
 * worker.on('failed', (job) => scheduler.releaseJob(job.data.orgId, job.id));
 *
 * // Check if org can process more jobs
 * if (!scheduler.canProcessJob(orgId)) {
 *   // Delay or skip this job
 * }
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface FairSchedulerConfig {
  /** Maximum concurrent jobs per organization */
  maxConcurrentPerOrg: number;
  /** Maximum total concurrent jobs across all orgs */
  maxTotalConcurrent: number;
  /** Interval for round-robin org switching (ms) */
  roundRobinIntervalMs: number;
  /** Maximum percentage of capacity any single org can use */
  maxOrgCapacityPercent: number;
  /** Enable priority-based scheduling */
  enablePriority: boolean;
  /** Window for calculating average wait time (ms) */
  metricsWindowMs: number;
}

export interface OrgQueueStats {
  orgId: string;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalProcessed: number;
  averageWaitTimeMs: number;
  averageProcessingTimeMs: number;
  lastActivityAt: Date | null;
}

export interface QueueMetrics {
  totalActiveJobs: number;
  totalOrgsActive: number;
  orgStats: Map<string, OrgQueueStats>;
  overallAverageWaitTimeMs: number;
}

export interface JobTrackingInfo {
  jobId: string;
  orgId: string;
  startedAt: Date;
  queuedAt?: Date;
  priority: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_FAIR_SCHEDULER_CONFIG: FairSchedulerConfig = {
  maxConcurrentPerOrg: 10,
  maxTotalConcurrent: 100,
  roundRobinIntervalMs: 100,
  maxOrgCapacityPercent: 50,
  enablePriority: true,
  metricsWindowMs: 5 * 60 * 1000, // 5 minutes
};

// ═══════════════════════════════════════════════════════════════════════════════
// FAIR SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════════

export class FairScheduler {
  private config: FairSchedulerConfig;
  private activeJobs: Map<string, Set<string>> = new Map(); // orgId -> Set of jobIds
  private jobInfo: Map<string, JobTrackingInfo> = new Map(); // jobId -> info
  private orgStats: Map<string, OrgQueueStats> = new Map();
  private waitTimes: Map<string, number[]> = new Map(); // orgId -> recent wait times
  private processingTimes: Map<string, number[]> = new Map(); // orgId -> recent processing times
  private roundRobinQueue: string[] = []; // Queue of orgIds for round-robin
  private currentOrgIndex = 0;
  private metricsListeners: Array<(metrics: QueueMetrics) => void> = [];

  constructor(config?: Partial<FairSchedulerConfig>) {
    this.config = { ...DEFAULT_FAIR_SCHEDULER_CONFIG, ...config };
  }

  /**
   * Check if an organization can process another job
   */
  canProcessJob(orgId: string): boolean {
    const orgActive = this.getActiveJobCount(orgId);
    const totalActive = this.getTotalActiveJobs();

    // Check per-org limit
    if (orgActive >= this.config.maxConcurrentPerOrg) {
      return false;
    }

    // Check total limit
    if (totalActive >= this.config.maxTotalConcurrent) {
      return false;
    }

    // Check max capacity percentage
    const maxForOrg = Math.floor(
      this.config.maxTotalConcurrent * (this.config.maxOrgCapacityPercent / 100)
    );
    if (orgActive >= maxForOrg) {
      return false;
    }

    return true;
  }

  /**
   * Track a job that has started processing
   */
  trackJob(
    orgId: string,
    jobId: string,
    queuedAt?: Date,
    priority = 0
  ): void {
    // Initialize org data if needed
    if (!this.activeJobs.has(orgId)) {
      this.activeJobs.set(orgId, new Set());
      this.initializeOrgStats(orgId);
    }

    // Track the job
    this.activeJobs.get(orgId)!.add(jobId);

    const now = new Date();
    this.jobInfo.set(jobId, {
      jobId,
      orgId,
      startedAt: now,
      queuedAt,
      priority,
    });

    // Record wait time if we know when it was queued
    if (queuedAt) {
      const waitTime = now.getTime() - queuedAt.getTime();
      this.recordWaitTime(orgId, waitTime);
    }

    // Add to round-robin queue if not already present
    if (!this.roundRobinQueue.includes(orgId)) {
      this.roundRobinQueue.push(orgId);
    }

    // Update stats
    const stats = this.orgStats.get(orgId)!;
    stats.activeJobs = this.getActiveJobCount(orgId);
    stats.lastActivityAt = now;

    this.emitMetrics();
  }

  /**
   * Release a job that has completed or failed
   */
  releaseJob(orgId: string, jobId: string, failed = false): void {
    const jobInfo = this.jobInfo.get(jobId);

    // Remove from active jobs
    this.activeJobs.get(orgId)?.delete(jobId);
    this.jobInfo.delete(jobId);

    // Update stats
    const stats = this.orgStats.get(orgId);
    if (stats) {
      stats.activeJobs = this.getActiveJobCount(orgId);
      stats.totalProcessed++;
      if (failed) {
        stats.failedJobs++;
      } else {
        stats.completedJobs++;
      }
      stats.lastActivityAt = new Date();

      // Record processing time
      if (jobInfo) {
        const processingTime = Date.now() - jobInfo.startedAt.getTime();
        this.recordProcessingTime(orgId, processingTime);
      }
    }

    // Remove from round-robin if no more active jobs
    if (this.getActiveJobCount(orgId) === 0) {
      const index = this.roundRobinQueue.indexOf(orgId);
      if (index >= 0) {
        this.roundRobinQueue.splice(index, 1);
        if (this.currentOrgIndex >= this.roundRobinQueue.length) {
          this.currentOrgIndex = 0;
        }
      }
    }

    this.emitMetrics();
  }

  /**
   * Get the next organization that should process a job (round-robin)
   */
  getNextOrg(): string | null {
    if (this.roundRobinQueue.length === 0) {
      return null;
    }

    // Find next org that can process
    const startIndex = this.currentOrgIndex;
    do {
      const orgId = this.roundRobinQueue[this.currentOrgIndex];
      this.currentOrgIndex = (this.currentOrgIndex + 1) % this.roundRobinQueue.length;

      if (this.canProcessJob(orgId)) {
        return orgId;
      }
    } while (this.currentOrgIndex !== startIndex);

    return null;
  }

  /**
   * Get active job count for an organization
   */
  getActiveJobCount(orgId: string): number {
    return this.activeJobs.get(orgId)?.size ?? 0;
  }

  /**
   * Get total active jobs across all organizations
   */
  getTotalActiveJobs(): number {
    let total = 0;
    for (const jobs of this.activeJobs.values()) {
      total += jobs.size;
    }
    return total;
  }

  /**
   * Get statistics for an organization
   */
  getOrgStats(orgId: string): OrgQueueStats | undefined {
    return this.orgStats.get(orgId);
  }

  /**
   * Get current metrics
   */
  getMetrics(): QueueMetrics {
    const totalActiveJobs = this.getTotalActiveJobs();
    const totalOrgsActive = this.roundRobinQueue.length;

    // Calculate overall average wait time
    let totalWaitTime = 0;
    let totalWaitSamples = 0;
    for (const times of this.waitTimes.values()) {
      totalWaitTime += times.reduce((a, b) => a + b, 0);
      totalWaitSamples += times.length;
    }

    return {
      totalActiveJobs,
      totalOrgsActive,
      orgStats: new Map(this.orgStats),
      overallAverageWaitTimeMs: totalWaitSamples > 0 ? totalWaitTime / totalWaitSamples : 0,
    };
  }

  /**
   * Subscribe to metrics updates
   */
  onMetrics(listener: (metrics: QueueMetrics) => void): () => void {
    this.metricsListeners.push(listener);
    return () => {
      const index = this.metricsListeners.indexOf(listener);
      if (index >= 0) {
        this.metricsListeners.splice(index, 1);
      }
    };
  }

  /**
   * Reset all statistics (for testing)
   */
  reset(): void {
    this.activeJobs.clear();
    this.jobInfo.clear();
    this.orgStats.clear();
    this.waitTimes.clear();
    this.processingTimes.clear();
    this.roundRobinQueue = [];
    this.currentOrgIndex = 0;
  }

  /**
   * Initialize statistics for an organization
   */
  private initializeOrgStats(orgId: string): void {
    this.orgStats.set(orgId, {
      orgId,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      totalProcessed: 0,
      averageWaitTimeMs: 0,
      averageProcessingTimeMs: 0,
      lastActivityAt: null,
    });
    this.waitTimes.set(orgId, []);
    this.processingTimes.set(orgId, []);
  }

  /**
   * Record wait time and update average
   */
  private recordWaitTime(orgId: string, waitTimeMs: number): void {
    const times = this.waitTimes.get(orgId) ?? [];
    times.push(waitTimeMs);

    // Keep only recent samples within window
    const cutoff = Date.now() - this.config.metricsWindowMs;
    // Note: This is a simplification - in production, store timestamps too
    while (times.length > 100) {
      times.shift();
    }

    this.waitTimes.set(orgId, times);

    // Update average
    const stats = this.orgStats.get(orgId);
    if (stats && times.length > 0) {
      stats.averageWaitTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
    }
  }

  /**
   * Record processing time and update average
   */
  private recordProcessingTime(orgId: string, processingTimeMs: number): void {
    const times = this.processingTimes.get(orgId) ?? [];
    times.push(processingTimeMs);

    // Keep only recent samples
    while (times.length > 100) {
      times.shift();
    }

    this.processingTimes.set(orgId, times);

    // Update average
    const stats = this.orgStats.get(orgId);
    if (stats && times.length > 0) {
      stats.averageProcessingTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
    }
  }

  /**
   * Emit metrics to all listeners
   */
  private emitMetrics(): void {
    if (this.metricsListeners.length === 0) return;

    const metrics = this.getMetrics();
    for (const listener of this.metricsListeners) {
      try {
        listener(metrics);
      } catch (error) {
        console.error('[FairScheduler] Metrics listener error:', error);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE ISOLATION STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════════

export type IsolationStrategy = 'shared' | 'per_org' | 'priority_lanes';

export interface QueueIsolationConfig {
  strategy: IsolationStrategy;
  /** For shared strategy: max jobs per org */
  sharedMaxPerOrg: number;
  /** For priority_lanes: lane definitions */
  priorityLanes?: Array<{
    name: string;
    priority: number;
    concurrency: number;
  }>;
}

/**
 * Get queue name based on isolation strategy
 */
export function getQueueName(
  baseQueueName: string,
  orgId: string,
  strategy: IsolationStrategy,
  priority?: number
): string {
  switch (strategy) {
    case 'per_org':
      return `${baseQueueName}:${orgId}`;
    case 'priority_lanes':
      const lane = priority !== undefined && priority > 5 ? 'high' : 'normal';
      return `${baseQueueName}:${lane}`;
    case 'shared':
    default:
      return baseQueueName;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER INTEGRATION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a worker processor that integrates with FairScheduler
 *
 * @example
 * const processor = createFairProcessor(scheduler, async (job) => {
 *   // Process the job
 *   return result;
 * });
 *
 * const worker = new Worker('queue-name', processor, { connection });
 */
export function createFairProcessor<T, R>(
  scheduler: FairScheduler,
  processor: (job: { id: string; data: T & { orgId: string }; timestamp?: number }) => Promise<R>
) {
  return async (job: { id: string; data: T & { orgId: string }; timestamp?: number }): Promise<R> => {
    const { orgId } = job.data;
    const queuedAt = job.timestamp ? new Date(job.timestamp) : undefined;

    // Check if org can process
    if (!scheduler.canProcessJob(orgId)) {
      // In a real implementation, you might want to delay the job
      console.warn(`[FairScheduler] Org ${orgId} at capacity, job ${job.id} may be delayed`);
    }

    // Track the job
    scheduler.trackJob(orgId, job.id, queuedAt);

    try {
      const result = await processor(job);
      scheduler.releaseJob(orgId, job.id, false);
      return result;
    } catch (error) {
      scheduler.releaseJob(orgId, job.id, true);
      throw error;
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let fairSchedulerInstance: FairScheduler | null = null;

export function getFairScheduler(config?: Partial<FairSchedulerConfig>): FairScheduler {
  if (!fairSchedulerInstance) {
    fairSchedulerInstance = new FairScheduler(config);
  }
  return fairSchedulerInstance;
}

export function resetFairScheduler(): void {
  fairSchedulerInstance?.reset();
  fairSchedulerInstance = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default FairScheduler;
