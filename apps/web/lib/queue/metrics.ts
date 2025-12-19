/**
 * CampoTech Queue Metrics (Phase 5B.2.1)
 * =======================================
 *
 * Metrics collection system with Little's Law calculations for queue analysis.
 *
 * Little's Law: L = λ × W
 * - L = average number of items in the system (queue depth)
 * - λ = average arrival rate (jobs per second)
 * - W = average wait time (seconds)
 *
 * Features:
 * - Real-time queue depth tracking
 * - Throughput measurement (jobs/second)
 * - Latency tracking (wait time, processing time)
 * - SLA compliance monitoring
 * - Historical time-series data
 *
 * Usage:
 * ```typescript
 * import { recordJobEnqueued, recordJobCompleted, getQueueMetrics } from '@/lib/queue/metrics';
 *
 * // Record metrics on job events
 * await recordJobEnqueued('realtime', 'notification.push');
 * await recordJobCompleted('realtime', 'notification.push', 150, true);
 *
 * // Get metrics for dashboard
 * const metrics = await getQueueMetrics();
 * console.log(metrics.realtime.throughput, 'jobs/sec');
 * ```
 */

import { redis } from '../cache';
import {
  type QueueTier,
  type JobType,
  QUEUE_TIERS,
  QUEUE_CONFIG,
  queueKey,
  dlqKey,
} from './config';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Metrics for a single queue tier
 */
export interface TierMetrics {
  /** Queue name/tier */
  tier: QueueTier;

  /** Current queue depth (pending jobs) */
  depth: number;

  /** Jobs in dead letter queue */
  dlqDepth: number;

  /** Throughput: jobs processed per second (last minute) */
  throughput: number;

  /** Average wait time in queue (ms) */
  avgWaitTime: number;

  /** Average processing time (ms) */
  avgProcessingTime: number;

  /** Total latency: wait + processing (ms) */
  avgLatency: number;

  /** Success rate (0-100%) */
  successRate: number;

  /** SLA compliance rate (0-100%) */
  slaCompliance: number;

  /** Jobs processed in last hour */
  processedLastHour: number;

  /** Jobs failed in last hour */
  failedLastHour: number;

  /** Little's Law prediction: expected queue depth */
  littleLawDepth: number;

  /** Whether queue is healthy (SLA compliance > 95%) */
  healthy: boolean;
}

/**
 * Aggregated metrics across all tiers
 */
export interface QueueMetrics {
  /** Timestamp of metrics collection */
  timestamp: Date;

  /** Metrics by tier */
  tiers: Record<QueueTier, TierMetrics>;

  /** System-wide aggregates */
  aggregate: {
    totalDepth: number;
    totalDlqDepth: number;
    avgThroughput: number;
    avgLatency: number;
    overallSuccessRate: number;
    overallSlaCompliance: number;
    totalProcessedLastHour: number;
    totalFailedLastHour: number;
  };

  /** Health status */
  health: {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
  };
}

/**
 * Time-series data point
 */
export interface MetricDataPoint {
  timestamp: number;
  value: number;
}

/**
 * Historical metrics for trending
 */
export interface HistoricalMetrics {
  tier: QueueTier;
  period: 'hour' | 'day' | 'week';
  throughput: MetricDataPoint[];
  latency: MetricDataPoint[];
  depth: MetricDataPoint[];
  successRate: MetricDataPoint[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS KEYS
// ═══════════════════════════════════════════════════════════════════════════════

const METRICS_KEYS = {
  // Counters (sliding window)
  enqueued: (tier: QueueTier) => `metrics:${tier}:enqueued`,
  completed: (tier: QueueTier) => `metrics:${tier}:completed`,
  failed: (tier: QueueTier) => `metrics:${tier}:failed`,

  // Timing (sorted sets for percentiles)
  waitTime: (tier: QueueTier) => `metrics:${tier}:wait_time`,
  processingTime: (tier: QueueTier) => `metrics:${tier}:processing_time`,

  // SLA tracking
  slaHits: (tier: QueueTier) => `metrics:${tier}:sla_hits`,
  slaMisses: (tier: QueueTier) => `metrics:${tier}:sla_misses`,

  // Time-series (for historical data)
  timeSeries: (tier: QueueTier, metric: string, bucket: string) =>
    `metrics:${tier}:ts:${metric}:${bucket}`,

  // Job type breakdown
  jobTypeCount: (tier: QueueTier, jobType: string, status: string) =>
    `metrics:${tier}:job:${jobType}:${status}`,
};

// Metrics window in seconds (5 minutes for real-time metrics)
const METRICS_WINDOW = 300;
// Bucket size for time-series (1 minute)
const BUCKET_SIZE = 60;

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC RECORDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record a job being enqueued
 */
export async function recordJobEnqueued(
  tier: QueueTier,
  jobType: JobType
): Promise<void> {
  if (!redis) return;

  const now = Date.now();
  const bucket = getTimeBucket(now);

  try {
    await Promise.all([
      // Increment enqueued counter
      redis.zadd(METRICS_KEYS.enqueued(tier), { score: now, member: `${now}:${Math.random()}` }),
      // Track by job type
      redis.incr(METRICS_KEYS.jobTypeCount(tier, jobType, 'enqueued')),
      // Time-series bucket
      redis.hincrby(METRICS_KEYS.timeSeries(tier, 'enqueued', bucket), 'count', 1),
    ]);

    // Clean up old entries (keep only last window)
    await cleanupOldMetrics(tier, now);
  } catch (error) {
    console.error('[Metrics] Error recording enqueue:', error);
  }
}

/**
 * Record a job being completed
 *
 * @param tier - Queue tier
 * @param jobType - Job type
 * @param durationMs - Total processing duration in milliseconds
 * @param success - Whether the job succeeded
 * @param waitTimeMs - Time spent waiting in queue (optional)
 */
export async function recordJobCompleted(
  tier: QueueTier,
  jobType: JobType,
  durationMs: number,
  success: boolean,
  waitTimeMs?: number
): Promise<void> {
  if (!redis) return;

  const now = Date.now();
  const bucket = getTimeBucket(now);
  const tierConfig = QUEUE_TIERS[tier];
  const withinSla = durationMs <= tierConfig.slaMs;

  try {
    const operations: Promise<unknown>[] = [
      // Record completion
      redis.zadd(METRICS_KEYS.completed(tier), { score: now, member: `${now}:${Math.random()}` }),

      // Record processing time
      redis.zadd(METRICS_KEYS.processingTime(tier), { score: now, member: `${durationMs}:${now}` }),

      // Track by job type
      redis.incr(METRICS_KEYS.jobTypeCount(tier, jobType, success ? 'completed' : 'failed')),

      // Time-series
      redis.hincrby(METRICS_KEYS.timeSeries(tier, 'completed', bucket), 'count', 1),
      redis.hincrby(METRICS_KEYS.timeSeries(tier, 'latency', bucket), 'sum', Math.round(durationMs)),
      redis.hincrby(METRICS_KEYS.timeSeries(tier, 'latency', bucket), 'count', 1),
    ];

    // Track wait time if provided
    if (waitTimeMs !== undefined) {
      operations.push(
        redis.zadd(METRICS_KEYS.waitTime(tier), { score: now, member: `${waitTimeMs}:${now}` })
      );
    }

    // Track success/failure
    if (success) {
      // SLA tracking
      if (withinSla) {
        operations.push(redis.zadd(METRICS_KEYS.slaHits(tier), { score: now, member: `${now}` }));
      } else {
        operations.push(redis.zadd(METRICS_KEYS.slaMisses(tier), { score: now, member: `${now}` }));
      }
    } else {
      operations.push(
        redis.zadd(METRICS_KEYS.failed(tier), { score: now, member: `${now}:${Math.random()}` })
      );
    }

    await Promise.all(operations);
  } catch (error) {
    console.error('[Metrics] Error recording completion:', error);
  }
}

/**
 * Record a job failure (separate from completion for explicit failure tracking)
 */
export async function recordJobFailed(
  tier: QueueTier,
  jobType: JobType,
  error: string
): Promise<void> {
  if (!redis) return;

  const now = Date.now();

  try {
    await Promise.all([
      redis.zadd(METRICS_KEYS.failed(tier), { score: now, member: `${now}:${Math.random()}` }),
      redis.incr(METRICS_KEYS.jobTypeCount(tier, jobType, 'failed')),
    ]);
  } catch (err) {
    console.error('[Metrics] Error recording failure:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC RETRIEVAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current queue depth for a tier
 */
async function getQueueDepth(tier: QueueTier): Promise<number> {
  if (!redis) return 0;

  try {
    const depth = await redis.zcard(queueKey(tier));
    return depth;
  } catch (error) {
    console.error('[Metrics] Error getting queue depth:', error);
    return 0;
  }
}

/**
 * Get DLQ depth for a tier
 */
async function getDlqDepth(tier: QueueTier): Promise<number> {
  if (!redis) return 0;

  try {
    const depth = await redis.zcard(dlqKey(tier));
    return depth;
  } catch (error) {
    console.error('[Metrics] Error getting DLQ depth:', error);
    return 0;
  }
}

/**
 * Get count from a sliding window counter
 */
async function getWindowCount(key: string, windowMs: number = METRICS_WINDOW * 1000): Promise<number> {
  if (!redis) return 0;

  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    const count = await redis.zcount(key, windowStart, now);
    return count;
  } catch (error) {
    console.error('[Metrics] Error getting window count:', error);
    return 0;
  }
}

/**
 * Get average from a timing sorted set
 */
async function getAverageTiming(key: string, windowMs: number = METRICS_WINDOW * 1000): Promise<number> {
  if (!redis) return 0;

  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Get entries in window using zrange with BYSCORE (Upstash Redis REST API)
    const entries = await redis.zrange(key, windowStart, now, { byScore: true }) as string[];

    if (entries.length === 0) return 0;

    // Parse timing values (format: "duration:timestamp")
    const timings = entries.map((entry: string) => {
      const [duration] = entry.split(':');
      return parseFloat(duration);
    });

    const sum = timings.reduce((a: number, b: number) => a + b, 0);
    return Math.round(sum / timings.length);
  } catch (error) {
    console.error('[Metrics] Error getting average timing:', error);
    return 0;
  }
}

/**
 * Calculate throughput (jobs per second)
 */
async function calculateThroughput(tier: QueueTier): Promise<number> {
  const completed = await getWindowCount(METRICS_KEYS.completed(tier));
  // Throughput = completed jobs / window seconds
  return completed / METRICS_WINDOW;
}

/**
 * Calculate SLA compliance rate
 */
async function calculateSlaCompliance(tier: QueueTier): Promise<number> {
  const [hits, misses] = await Promise.all([
    getWindowCount(METRICS_KEYS.slaHits(tier)),
    getWindowCount(METRICS_KEYS.slaMisses(tier)),
  ]);

  const total = hits + misses;
  if (total === 0) return 100; // No jobs = 100% compliant

  return (hits / total) * 100;
}

/**
 * Calculate success rate
 */
async function calculateSuccessRate(tier: QueueTier): Promise<number> {
  const [completed, failed] = await Promise.all([
    getWindowCount(METRICS_KEYS.completed(tier)),
    getWindowCount(METRICS_KEYS.failed(tier)),
  ]);

  const total = completed + failed;
  if (total === 0) return 100;

  return (completed / total) * 100;
}

/**
 * Get metrics for a single tier
 */
async function getTierMetrics(tier: QueueTier): Promise<TierMetrics> {
  const tierConfig = QUEUE_TIERS[tier];

  // Fetch all metrics in parallel
  const [
    depth,
    dlqDepth,
    throughput,
    avgWaitTime,
    avgProcessingTime,
    successRate,
    slaCompliance,
    processedLastHour,
    failedLastHour,
  ] = await Promise.all([
    getQueueDepth(tier),
    getDlqDepth(tier),
    calculateThroughput(tier),
    getAverageTiming(METRICS_KEYS.waitTime(tier)),
    getAverageTiming(METRICS_KEYS.processingTime(tier)),
    calculateSuccessRate(tier),
    calculateSlaCompliance(tier),
    getWindowCount(METRICS_KEYS.completed(tier), 3600000), // 1 hour
    getWindowCount(METRICS_KEYS.failed(tier), 3600000),
  ]);

  const avgLatency = avgWaitTime + avgProcessingTime;

  // Little's Law: L = λ × W
  // λ = throughput (jobs/second)
  // W = average latency (seconds)
  const littleLawDepth = throughput * (avgLatency / 1000);

  return {
    tier,
    depth,
    dlqDepth,
    throughput: Math.round(throughput * 1000) / 1000, // 3 decimal places
    avgWaitTime,
    avgProcessingTime,
    avgLatency,
    successRate: Math.round(successRate * 10) / 10,
    slaCompliance: Math.round(slaCompliance * 10) / 10,
    processedLastHour,
    failedLastHour,
    littleLawDepth: Math.round(littleLawDepth * 100) / 100,
    healthy: slaCompliance >= 95 && successRate >= 95,
  };
}

/**
 * Get comprehensive queue metrics
 */
export async function getQueueMetrics(): Promise<QueueMetrics> {
  const tiers: QueueTier[] = ['realtime', 'background', 'batch'];

  // Fetch metrics for all tiers in parallel
  const tierMetrics = await Promise.all(tiers.map(getTierMetrics));

  // Build tier map
  const tierMap = tierMetrics.reduce(
    (acc, metrics) => {
      acc[metrics.tier] = metrics;
      return acc;
    },
    {} as Record<QueueTier, TierMetrics>
  );

  // Calculate aggregates
  const totalDepth = tierMetrics.reduce((sum, t) => sum + t.depth, 0);
  const totalDlqDepth = tierMetrics.reduce((sum, t) => sum + t.dlqDepth, 0);
  const avgThroughput = tierMetrics.reduce((sum, t) => sum + t.throughput, 0);
  const avgLatency =
    tierMetrics.length > 0
      ? tierMetrics.reduce((sum, t) => sum + t.avgLatency, 0) / tierMetrics.length
      : 0;

  const totalProcessed = tierMetrics.reduce((sum, t) => sum + t.processedLastHour, 0);
  const totalFailed = tierMetrics.reduce((sum, t) => sum + t.failedLastHour, 0);
  const overallSuccessRate =
    totalProcessed + totalFailed > 0
      ? (totalProcessed / (totalProcessed + totalFailed)) * 100
      : 100;

  // Calculate weighted SLA compliance
  const totalJobs = tierMetrics.reduce((sum, t) => sum + t.processedLastHour, 0);
  const overallSlaCompliance =
    totalJobs > 0
      ? tierMetrics.reduce(
          (sum, t) => sum + t.slaCompliance * t.processedLastHour,
          0
        ) / totalJobs
      : 100;

  // Determine health status
  const issues: string[] = [];
  tierMetrics.forEach((t) => {
    if (t.slaCompliance < 95) {
      issues.push(`${t.tier}: SLA compliance at ${t.slaCompliance}%`);
    }
    if (t.successRate < 95) {
      issues.push(`${t.tier}: Success rate at ${t.successRate}%`);
    }
    if (t.dlqDepth > 100) {
      issues.push(`${t.tier}: ${t.dlqDepth} jobs in DLQ`);
    }
  });

  let status: 'healthy' | 'degraded' | 'critical';
  if (issues.length === 0) {
    status = 'healthy';
  } else if (issues.length <= 2) {
    status = 'degraded';
  } else {
    status = 'critical';
  }

  return {
    timestamp: new Date(),
    tiers: tierMap,
    aggregate: {
      totalDepth,
      totalDlqDepth,
      avgThroughput: Math.round(avgThroughput * 1000) / 1000,
      avgLatency: Math.round(avgLatency),
      overallSuccessRate: Math.round(overallSuccessRate * 10) / 10,
      overallSlaCompliance: Math.round(overallSlaCompliance * 10) / 10,
      totalProcessedLastHour: totalProcessed,
      totalFailedLastHour: totalFailed,
    },
    health: {
      status,
      issues,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LITTLE'S LAW CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Little's Law analysis result
 */
export interface LittleLawAnalysis {
  tier: QueueTier;

  /** Current observed queue depth */
  observedDepth: number;

  /** Predicted depth from Little's Law (L = λW) */
  predictedDepth: number;

  /** Current arrival rate (jobs/second) */
  arrivalRate: number;

  /** Current throughput (jobs/second) */
  throughput: number;

  /** Average time in system (seconds) */
  avgTimeInSystem: number;

  /** Whether the queue is stable (throughput >= arrival) */
  isStable: boolean;

  /** Estimated time to drain queue at current rate (seconds) */
  estimatedDrainTime: number;

  /** Recommended concurrency adjustment */
  concurrencyRecommendation: 'increase' | 'maintain' | 'decrease';

  /** Bottleneck analysis */
  bottleneck: 'arrival' | 'processing' | 'none';
}

/**
 * Perform Little's Law analysis for capacity planning
 */
export async function analyzeLittleLaw(tier: QueueTier): Promise<LittleLawAnalysis> {
  const tierConfig = QUEUE_TIERS[tier];

  // Get current metrics
  const [depth, enqueued, completed, avgLatency] = await Promise.all([
    getQueueDepth(tier),
    getWindowCount(METRICS_KEYS.enqueued(tier)),
    getWindowCount(METRICS_KEYS.completed(tier)),
    getAverageTiming(METRICS_KEYS.processingTime(tier)),
  ]);

  // Calculate rates
  const arrivalRate = enqueued / METRICS_WINDOW;
  const throughput = completed / METRICS_WINDOW;
  const avgTimeInSystem = avgLatency / 1000; // Convert to seconds

  // Little's Law prediction
  const predictedDepth = arrivalRate * avgTimeInSystem;

  // Stability analysis
  const isStable = throughput >= arrivalRate * 0.95; // 5% tolerance

  // Drain time estimation
  const drainRate = Math.max(0, throughput - arrivalRate);
  const estimatedDrainTime = drainRate > 0 ? depth / drainRate : Infinity;

  // Concurrency recommendation
  let concurrencyRecommendation: 'increase' | 'maintain' | 'decrease';
  if (!isStable || depth > tierConfig.concurrency * 10) {
    concurrencyRecommendation = 'increase';
  } else if (throughput > arrivalRate * 1.5 && depth < tierConfig.concurrency) {
    concurrencyRecommendation = 'decrease';
  } else {
    concurrencyRecommendation = 'maintain';
  }

  // Bottleneck analysis
  let bottleneck: 'arrival' | 'processing' | 'none';
  if (arrivalRate > throughput * 1.2) {
    bottleneck = 'processing'; // Can't keep up with arrivals
  } else if (throughput > arrivalRate * 2 && depth === 0) {
    bottleneck = 'arrival'; // Over-provisioned, waiting for work
  } else {
    bottleneck = 'none';
  }

  return {
    tier,
    observedDepth: depth,
    predictedDepth: Math.round(predictedDepth * 100) / 100,
    arrivalRate: Math.round(arrivalRate * 1000) / 1000,
    throughput: Math.round(throughput * 1000) / 1000,
    avgTimeInSystem: Math.round(avgTimeInSystem * 1000) / 1000,
    isStable,
    estimatedDrainTime:
      estimatedDrainTime === Infinity
        ? -1
        : Math.round(estimatedDrainTime),
    concurrencyRecommendation,
    bottleneck,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORICAL METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get historical metrics for trending
 */
export async function getHistoricalMetrics(
  tier: QueueTier,
  period: 'hour' | 'day' | 'week' = 'hour'
): Promise<HistoricalMetrics> {
  if (!redis) {
    return {
      tier,
      period,
      throughput: [],
      latency: [],
      depth: [],
      successRate: [],
    };
  }

  const buckets = getBucketsForPeriod(period);
  const metrics: HistoricalMetrics = {
    tier,
    period,
    throughput: [],
    latency: [],
    depth: [],
    successRate: [],
  };

  try {
    for (const bucket of buckets) {
      const [completedData, latencyData] = await Promise.all([
        redis.hgetall(METRICS_KEYS.timeSeries(tier, 'completed', bucket)),
        redis.hgetall(METRICS_KEYS.timeSeries(tier, 'latency', bucket)),
      ]);

      const timestamp = parseInt(bucket) * 1000;
      const completedCount = parseInt((completedData as Record<string, string>)?.count || '0');
      const latencySum = parseInt((latencyData as Record<string, string>)?.sum || '0');
      const latencyCount = parseInt((latencyData as Record<string, string>)?.count || '0');

      metrics.throughput.push({
        timestamp,
        value: completedCount / BUCKET_SIZE,
      });

      metrics.latency.push({
        timestamp,
        value: latencyCount > 0 ? latencySum / latencyCount : 0,
      });
    }
  } catch (error) {
    console.error('[Metrics] Error getting historical metrics:', error);
  }

  return metrics;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get time bucket for a timestamp
 */
function getTimeBucket(timestampMs: number): string {
  return Math.floor(timestampMs / (BUCKET_SIZE * 1000)).toString();
}

/**
 * Get bucket keys for a time period
 */
function getBucketsForPeriod(period: 'hour' | 'day' | 'week'): string[] {
  const now = Date.now();
  const bucketCount =
    period === 'hour' ? 60 : period === 'day' ? 1440 : 10080;
  const buckets: string[] = [];

  for (let i = 0; i < Math.min(bucketCount, 60); i++) {
    // Limit to 60 buckets
    const timestamp = now - i * BUCKET_SIZE * 1000;
    buckets.push(getTimeBucket(timestamp));
  }

  return buckets.reverse();
}

/**
 * Clean up old metric entries
 */
async function cleanupOldMetrics(tier: QueueTier, now: number): Promise<void> {
  if (!redis) return;

  const windowStart = now - METRICS_WINDOW * 1000;

  try {
    // Remove entries older than the window
    await Promise.all([
      redis.zremrangebyscore(METRICS_KEYS.enqueued(tier), 0, windowStart),
      redis.zremrangebyscore(METRICS_KEYS.completed(tier), 0, windowStart),
      redis.zremrangebyscore(METRICS_KEYS.failed(tier), 0, windowStart),
      redis.zremrangebyscore(METRICS_KEYS.waitTime(tier), 0, windowStart),
      redis.zremrangebyscore(METRICS_KEYS.processingTime(tier), 0, windowStart),
      redis.zremrangebyscore(METRICS_KEYS.slaHits(tier), 0, windowStart),
      redis.zremrangebyscore(METRICS_KEYS.slaMisses(tier), 0, windowStart),
    ]);
  } catch (error) {
    // Silent cleanup failure - not critical
  }
}

/**
 * Reset all metrics for a tier (use with caution)
 */
export async function resetMetrics(tier: QueueTier): Promise<void> {
  if (!redis) return;

  const keys = [
    METRICS_KEYS.enqueued(tier),
    METRICS_KEYS.completed(tier),
    METRICS_KEYS.failed(tier),
    METRICS_KEYS.waitTime(tier),
    METRICS_KEYS.processingTime(tier),
    METRICS_KEYS.slaHits(tier),
    METRICS_KEYS.slaMisses(tier),
  ];

  try {
    await redis.del(...keys);
    console.log(`[Metrics] Reset metrics for ${tier}`);
  } catch (error) {
    console.error('[Metrics] Error resetting metrics:', error);
  }
}

/**
 * Get job type breakdown for a tier
 */
export async function getJobTypeBreakdown(tier: QueueTier): Promise<
  Array<{
    jobType: string;
    enqueued: number;
    completed: number;
    failed: number;
  }>
> {
  if (!redis) return [];

  // This would require scanning all job type keys
  // For now, return empty - can be implemented with proper key pattern
  return [];
}
