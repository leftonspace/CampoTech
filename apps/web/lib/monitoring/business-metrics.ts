/**
 * CampoTech Business Metrics (Phase 8.2.1)
 * =========================================
 *
 * Key business metrics tracking for observability and dashboarding.
 *
 * Metrics tracked:
 * - Request latency (p50, p95, p99)
 * - Error rate
 * - Active users
 * - Jobs created/day
 * - Invoices generated/day
 * - AI conversations/day
 * - Database query times
 *
 * Usage:
 * ```typescript
 * import { businessMetrics, trackDatabaseQuery, getMetricsSnapshot } from '@/lib/monitoring/business-metrics';
 *
 * // Track a database query
 * const endTimer = trackDatabaseQuery('findMany', 'jobs');
 * const result = await prisma.job.findMany();
 * endTimer({ success: true });
 *
 * // Increment business counter
 * businessMetrics.jobsCreated.inc({ org_id: 'org-123' });
 * ```
 */

import { Redis } from '@upstash/redis';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface _MetricLabels {
  [key: string]: string | number;
}

interface PercentileResult {
  p50: number;
  p95: number;
  p99: number;
  count: number;
  sum: number;
}

interface BusinessMetricsSnapshot {
  timestamp: Date;
  requestLatency: PercentileResult;
  errorRate: {
    total: number;
    errors: number;
    rate: number;
  };
  activeUsers: {
    last5min: number;
    last1hour: number;
    last24hours: number;
  };
  dailyStats: {
    jobsCreated: number;
    invoicesGenerated: number;
    aiConversations: number;
  };
  databaseLatency: PercentileResult;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// REDIS CLIENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
  }
  return redis;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// REDIS KEYS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const KEYS = {
  // Request latency tracking (sorted set with timestamp scores)
  requestLatency: 'metrics:request_latency',
  requestCount: 'metrics:request_count',
  errorCount: 'metrics:error_count',

  // Active users (sorted set with last activity timestamp)
  activeUsers: 'metrics:active_users',

  // Daily counters (with date suffix)
  jobsCreated: (date: string) => `metrics:jobs_created:${date}`,
  invoicesGenerated: (date: string) => `metrics:invoices_generated:${date}`,
  aiConversations: (date: string) => `metrics:ai_conversations:${date}`,

  // Database latency
  dbLatency: 'metrics:db_latency',

  // Prometheus text format cache
  prometheusCache: 'metrics:prometheus_cache',
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// METRIC RECORDING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Record HTTP request latency
 */
export async function recordRequestLatency(
  durationMs: number,
  labels: { method: string; route: string; status: number }
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const now = Date.now();
  const isError = labels.status >= 400;

  try {
    await Promise.all([
      // Record latency value with timestamp
      client.zadd(KEYS.requestLatency, { score: now, member: `${durationMs}:${now}` }),
      // Increment total request count
      client.incr(KEYS.requestCount),
      // Increment error count if applicable
      isError ? client.incr(KEYS.errorCount) : Promise.resolve(),
      // Cleanup old entries (keep last 5 minutes)
      client.zremrangebyscore(KEYS.requestLatency, 0, now - 300000),
    ]);
  } catch (error) {
    console.error('[Metrics] Error recording request latency:', error);
  }
}

/**
 * Record active user activity
 */
export async function recordActiveUser(userId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.zadd(KEYS.activeUsers, { score: Date.now(), member: userId });
    // Cleanup old entries (keep last 24 hours)
    await client.zremrangebyscore(KEYS.activeUsers, 0, Date.now() - 86400000);
  } catch (error) {
    console.error('[Metrics] Error recording active user:', error);
  }
}

/**
 * Record database query latency
 */
export async function recordDatabaseLatency(
  durationMs: number,
  _labels: { operation: string; table: string }
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const now = Date.now();

  try {
    await Promise.all([
      client.zadd(KEYS.dbLatency, { score: now, member: `${durationMs}:${now}` }),
      client.zremrangebyscore(KEYS.dbLatency, 0, now - 300000),
    ]);
  } catch (error) {
    console.error('[Metrics] Error recording DB latency:', error);
  }
}

/**
 * Track database query with automatic timing
 */
export function trackDatabaseQuery(
  operation: string,
  table: string
): (result: { success: boolean }) => void {
  const start = Date.now();
  return (_result: { success: boolean }) => {
    const duration = Date.now() - start;
    recordDatabaseLatency(duration, { operation, table });
  };
}

/**
 * Record job creation
 */
export async function recordJobCreated(_orgId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const today = new Date().toISOString().split('T')[0];

  try {
    await client.incr(KEYS.jobsCreated(today));
    // Set expiry for 7 days
    await client.expire(KEYS.jobsCreated(today), 604800);
  } catch (error) {
    console.error('[Metrics] Error recording job created:', error);
  }
}

/**
 * Record invoice generation
 */
export async function recordInvoiceGenerated(_orgId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const today = new Date().toISOString().split('T')[0];

  try {
    await client.incr(KEYS.invoicesGenerated(today));
    await client.expire(KEYS.invoicesGenerated(today), 604800);
  } catch (error) {
    console.error('[Metrics] Error recording invoice generated:', error);
  }
}

/**
 * Record AI conversation
 */
export async function recordAIConversation(_orgId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const today = new Date().toISOString().split('T')[0];

  try {
    await client.incr(KEYS.aiConversations(today));
    await client.expire(KEYS.aiConversations(today), 604800);
  } catch (error) {
    console.error('[Metrics] Error recording AI conversation:', error);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// METRIC RETRIEVAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Calculate percentiles from sorted set values
 */
async function getPercentiles(key: string): Promise<PercentileResult> {
  const client = getRedis();
  if (!client) {
    return { p50: 0, p95: 0, p99: 0, count: 0, sum: 0 };
  }

  try {
    const entries = (await client.zrange(key, 0, -1)) as string[];
    if (entries.length === 0) {
      return { p50: 0, p95: 0, p99: 0, count: 0, sum: 0 };
    }

    // Parse values (format: "duration:timestamp")
    const values = entries
      .map((entry) => parseFloat(entry.split(':')[0]))
      .sort((a, b) => a - b);

    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      p50: values[Math.floor(count * 0.5)] || 0,
      p95: values[Math.floor(count * 0.95)] || 0,
      p99: values[Math.floor(count * 0.99)] || 0,
      count,
      sum,
    };
  } catch (error) {
    console.error('[Metrics] Error calculating percentiles:', error);
    return { p50: 0, p95: 0, p99: 0, count: 0, sum: 0 };
  }
}

/**
 * Get active user counts
 */
async function getActiveUserCounts(): Promise<{
  last5min: number;
  last1hour: number;
  last24hours: number;
}> {
  const client = getRedis();
  if (!client) {
    return { last5min: 0, last1hour: 0, last24hours: 0 };
  }

  const now = Date.now();

  try {
    const [last5min, last1hour, last24hours] = await Promise.all([
      client.zcount(KEYS.activeUsers, now - 300000, now),
      client.zcount(KEYS.activeUsers, now - 3600000, now),
      client.zcount(KEYS.activeUsers, now - 86400000, now),
    ]);

    return { last5min, last1hour, last24hours };
  } catch (error) {
    console.error('[Metrics] Error getting active users:', error);
    return { last5min: 0, last1hour: 0, last24hours: 0 };
  }
}

/**
 * Get daily counter value
 */
async function getDailyCounter(keyFn: (date: string) => string): Promise<number> {
  const client = getRedis();
  if (!client) return 0;

  const today = new Date().toISOString().split('T')[0];

  try {
    const value = await client.get(keyFn(today));
    return typeof value === 'number' ? value : parseInt(value as string) || 0;
  } catch (error) {
    console.error('[Metrics] Error getting daily counter:', error);
    return 0;
  }
}

/**
 * Get error rate
 */
async function getErrorRate(): Promise<{ total: number; errors: number; rate: number }> {
  const client = getRedis();
  if (!client) {
    return { total: 0, errors: 0, rate: 0 };
  }

  try {
    const [total, errors] = await Promise.all([
      client.get(KEYS.requestCount),
      client.get(KEYS.errorCount),
    ]);

    const totalNum = typeof total === 'number' ? total : parseInt(total as string) || 0;
    const errorsNum = typeof errors === 'number' ? errors : parseInt(errors as string) || 0;

    return {
      total: totalNum,
      errors: errorsNum,
      rate: totalNum > 0 ? (errorsNum / totalNum) * 100 : 0,
    };
  } catch (error) {
    console.error('[Metrics] Error getting error rate:', error);
    return { total: 0, errors: 0, rate: 0 };
  }
}

/**
 * Get comprehensive metrics snapshot
 */
export async function getMetricsSnapshot(): Promise<BusinessMetricsSnapshot> {
  const [requestLatency, errorRate, activeUsers, databaseLatency, jobsCreated, invoicesGenerated, aiConversations] =
    await Promise.all([
      getPercentiles(KEYS.requestLatency),
      getErrorRate(),
      getActiveUserCounts(),
      getPercentiles(KEYS.dbLatency),
      getDailyCounter(KEYS.jobsCreated),
      getDailyCounter(KEYS.invoicesGenerated),
      getDailyCounter(KEYS.aiConversations),
    ]);

  return {
    timestamp: new Date(),
    requestLatency,
    errorRate,
    activeUsers,
    dailyStats: {
      jobsCreated,
      invoicesGenerated,
      aiConversations,
    },
    databaseLatency,
  };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PROMETHEUS EXPORT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Generate Prometheus text format metrics
 */
export async function toPrometheusFormat(): Promise<string> {
  const snapshot = await getMetricsSnapshot();
  const lines: string[] = [];

  // Request latency histogram summary
  lines.push('# HELP campotech_http_request_duration_ms HTTP request duration in milliseconds');
  lines.push('# TYPE campotech_http_request_duration_ms summary');
  lines.push(`campotech_http_request_duration_ms{quantile="0.5"} ${snapshot.requestLatency.p50}`);
  lines.push(`campotech_http_request_duration_ms{quantile="0.95"} ${snapshot.requestLatency.p95}`);
  lines.push(`campotech_http_request_duration_ms{quantile="0.99"} ${snapshot.requestLatency.p99}`);
  lines.push(`campotech_http_request_duration_ms_sum ${snapshot.requestLatency.sum}`);
  lines.push(`campotech_http_request_duration_ms_count ${snapshot.requestLatency.count}`);

  // Error rate
  lines.push('# HELP campotech_http_requests_total Total HTTP requests');
  lines.push('# TYPE campotech_http_requests_total counter');
  lines.push(`campotech_http_requests_total ${snapshot.errorRate.total}`);

  lines.push('# HELP campotech_http_errors_total Total HTTP errors');
  lines.push('# TYPE campotech_http_errors_total counter');
  lines.push(`campotech_http_errors_total ${snapshot.errorRate.errors}`);

  lines.push('# HELP campotech_error_rate_percent Current error rate percentage');
  lines.push('# TYPE campotech_error_rate_percent gauge');
  lines.push(`campotech_error_rate_percent ${snapshot.errorRate.rate.toFixed(2)}`);

  // Active users
  lines.push('# HELP campotech_active_users Number of active users');
  lines.push('# TYPE campotech_active_users gauge');
  lines.push(`campotech_active_users{window="5m"} ${snapshot.activeUsers.last5min}`);
  lines.push(`campotech_active_users{window="1h"} ${snapshot.activeUsers.last1hour}`);
  lines.push(`campotech_active_users{window="24h"} ${snapshot.activeUsers.last24hours}`);

  // Daily business metrics
  lines.push('# HELP campotech_jobs_created_today Jobs created today');
  lines.push('# TYPE campotech_jobs_created_today gauge');
  lines.push(`campotech_jobs_created_today ${snapshot.dailyStats.jobsCreated}`);

  lines.push('# HELP campotech_invoices_generated_today Invoices generated today');
  lines.push('# TYPE campotech_invoices_generated_today gauge');
  lines.push(`campotech_invoices_generated_today ${snapshot.dailyStats.invoicesGenerated}`);

  lines.push('# HELP campotech_ai_conversations_today AI conversations today');
  lines.push('# TYPE campotech_ai_conversations_today gauge');
  lines.push(`campotech_ai_conversations_today ${snapshot.dailyStats.aiConversations}`);

  // Database latency
  lines.push('# HELP campotech_db_query_duration_ms Database query duration in milliseconds');
  lines.push('# TYPE campotech_db_query_duration_ms summary');
  lines.push(`campotech_db_query_duration_ms{quantile="0.5"} ${snapshot.databaseLatency.p50}`);
  lines.push(`campotech_db_query_duration_ms{quantile="0.95"} ${snapshot.databaseLatency.p95}`);
  lines.push(`campotech_db_query_duration_ms{quantile="0.99"} ${snapshot.databaseLatency.p99}`);
  lines.push(`campotech_db_query_duration_ms_sum ${snapshot.databaseLatency.sum}`);
  lines.push(`campotech_db_query_duration_ms_count ${snapshot.databaseLatency.count}`);

  return lines.join('\n');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONVENIENCE OBJECT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const businessMetrics = {
  requestLatency: {
    record: recordRequestLatency,
  },
  activeUsers: {
    record: recordActiveUser,
  },
  database: {
    record: recordDatabaseLatency,
    track: trackDatabaseQuery,
  },
  jobsCreated: {
    inc: recordJobCreated,
  },
  invoicesGenerated: {
    inc: recordInvoiceGenerated,
  },
  aiConversations: {
    inc: recordAIConversation,
  },
};

export default businessMetrics;
