/**
 * Time Series Storage Service
 * ===========================
 *
 * Phase 10.1: Analytics Data Infrastructure
 * Efficient storage and retrieval of time-series data for analytics.
 */

import { log } from '../../lib/logging/logger';
import { getRedisConnection } from '../../lib/redis/client';
import { TimeGranularity, DateRange, TimeSeriesDataPoint, TimeSeriesData } from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TimeSeriesConfig {
  retentionPolicies: {
    raw: number;      // seconds
    minute: number;
    hour: number;
    day: number;
    week: number;
    month: number;
    quarter: number;
    year: number;
  };
  aggregationRules: {
    [key in TimeGranularity]?: TimeGranularity;
  };
}

export interface TimeSeriesPoint {
  timestamp: number; // Unix timestamp
  value: number;
  tags?: Record<string, string>;
}

export interface TimeSeriesQuery {
  organizationId: string;
  metric: string;
  startTime: Date;
  endTime: Date;
  granularity: TimeGranularity;
  tags?: Record<string, string>;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface TimeSeriesWriteResult {
  success: boolean;
  pointsWritten: number;
  errors?: string[];
}

export interface TimeSeriesDownsampleResult {
  sourceGranularity: TimeGranularity;
  targetGranularity: TimeGranularity;
  pointsProcessed: number;
  pointsCreated: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: TimeSeriesConfig = {
  retentionPolicies: {
    raw: 7 * 24 * 60 * 60,        // 7 days
    minute: 24 * 60 * 60,         // 1 day
    hour: 30 * 24 * 60 * 60,      // 30 days
    day: 365 * 24 * 60 * 60,      // 1 year
    week: 3 * 365 * 24 * 60 * 60, // 3 years
    month: 5 * 365 * 24 * 60 * 60, // 5 years
    quarter: 7 * 365 * 24 * 60 * 60, // 7 years
    year: 10 * 365 * 24 * 60 * 60,   // 10 years
  },
  aggregationRules: {
    hour: 'day',
    day: 'week',
    week: 'month',
  },
};

const TS_KEY_PREFIX = 'ts:';
const TS_INDEX_PREFIX = 'ts:idx:';

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Write a single time series point
 */
export async function writePoint(
  organizationId: string,
  metric: string,
  value: number,
  timestamp?: Date,
  tags?: Record<string, string>
): Promise<void> {
  const ts = timestamp || new Date();
  const point: TimeSeriesPoint = {
    timestamp: ts.getTime(),
    value,
    tags,
  };

  const redis = await getRedisConnection();
  const key = buildTimeSeriesKey(organizationId, metric, 'raw');

  // Use Redis Sorted Set with timestamp as score
  await redis.zadd(key, ts.getTime(), JSON.stringify(point));

  // Set expiration
  await redis.expire(key, DEFAULT_CONFIG.retentionPolicies.raw);

  // Update index
  await updateIndex(organizationId, metric, tags);
}

/**
 * Write multiple time series points
 */
export async function writePoints(
  organizationId: string,
  metric: string,
  points: Array<{ value: number; timestamp?: Date; tags?: Record<string, string> }>
): Promise<TimeSeriesWriteResult> {
  const redis = await getRedisConnection();
  const key = buildTimeSeriesKey(organizationId, metric, 'raw');

  const pipeline = redis.pipeline();
  let pointsWritten = 0;
  const errors: string[] = [];

  for (const point of points) {
    try {
      const ts = point.timestamp || new Date();
      const tsPoint: TimeSeriesPoint = {
        timestamp: ts.getTime(),
        value: point.value,
        tags: point.tags,
      };

      pipeline.zadd(key, ts.getTime(), JSON.stringify(tsPoint));
      pointsWritten++;
    } catch (error) {
      errors.push(`Failed to write point: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  pipeline.expire(key, DEFAULT_CONFIG.retentionPolicies.raw);
  await pipeline.exec();

  // Update index
  const uniqueTags = new Set<string>();
  for (const point of points) {
    if (point.tags) {
      Object.entries(point.tags).forEach(([k, v]) => uniqueTags.add(`${k}:${v}`));
    }
  }
  await updateIndex(organizationId, metric);

  return {
    success: errors.length === 0,
    pointsWritten,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Write aggregated time series data
 */
export async function writeAggregatedPoint(
  organizationId: string,
  metric: string,
  granularity: TimeGranularity,
  period: string,
  value: number,
  count: number = 1,
  min?: number,
  max?: number
): Promise<void> {
  const redis = await getRedisConnection();
  const key = buildTimeSeriesKey(organizationId, metric, granularity);

  const point = {
    period,
    value,
    count,
    min: min ?? value,
    max: max ?? value,
    avg: count > 0 ? value / count : value,
    updatedAt: Date.now(),
  };

  // Use hash for aggregated data
  await redis.hset(key, period, JSON.stringify(point));

  // Set expiration based on granularity
  const ttl = DEFAULT_CONFIG.retentionPolicies[granularity] || DEFAULT_CONFIG.retentionPolicies.day;
  await redis.expire(key, ttl);
}

// ═══════════════════════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Query time series data
 */
export async function queryTimeSeries(query: TimeSeriesQuery): Promise<TimeSeriesData> {
  const redis = await getRedisConnection();

  if (query.granularity === 'hour' || query.granularity === 'day') {
    // Try to get aggregated data first
    const aggregatedKey = buildTimeSeriesKey(query.organizationId, query.metric, query.granularity);
    const aggregatedData = await redis.hgetall(aggregatedKey);

    if (Object.keys(aggregatedData).length > 0) {
      const dataPoints = filterAndTransformAggregatedData(
        aggregatedData,
        query.startTime,
        query.endTime,
        query.granularity
      );

      return {
        metric: query.metric,
        granularity: query.granularity,
        data: dataPoints,
      };
    }
  }

  // Fall back to raw data
  const rawKey = buildTimeSeriesKey(query.organizationId, query.metric, 'raw');
  const rawPoints = await redis.zrangebyscore(
    rawKey,
    query.startTime.getTime(),
    query.endTime.getTime()
  );

  const dataPoints = transformRawData(rawPoints, query.granularity, query.aggregation);

  return {
    metric: query.metric,
    granularity: query.granularity,
    data: dataPoints,
  };
}

/**
 * Get the latest value for a metric
 */
export async function getLatestValue(
  organizationId: string,
  metric: string
): Promise<TimeSeriesDataPoint | null> {
  const redis = await getRedisConnection();
  const key = buildTimeSeriesKey(organizationId, metric, 'raw');

  const latest = await redis.zrevrange(key, 0, 0);

  if (latest.length === 0) return null;

  try {
    const point: TimeSeriesPoint = JSON.parse(latest[0]);
    return {
      timestamp: new Date(point.timestamp),
      value: point.value,
    };
  } catch {
    return null;
  }
}

/**
 * Get time series data for a specific period
 */
export async function getDataForPeriod(
  organizationId: string,
  metric: string,
  granularity: TimeGranularity,
  period: string
): Promise<{ value: number; count: number; min: number; max: number; avg: number } | null> {
  const redis = await getRedisConnection();
  const key = buildTimeSeriesKey(organizationId, metric, granularity);

  const data = await redis.hget(key, period);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Get range of time series data
 */
export async function getDataRange(
  organizationId: string,
  metric: string,
  dateRange: DateRange,
  granularity: TimeGranularity = 'day'
): Promise<TimeSeriesDataPoint[]> {
  const query: TimeSeriesQuery = {
    organizationId,
    metric,
    startTime: dateRange.start,
    endTime: dateRange.end,
    granularity,
  };

  const result = await queryTimeSeries(query);
  return result.data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATION & DOWNSAMPLING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Downsample time series data from one granularity to another
 */
export async function downsample(
  organizationId: string,
  metric: string,
  sourceGranularity: TimeGranularity,
  targetGranularity: TimeGranularity,
  dateRange: DateRange
): Promise<TimeSeriesDownsampleResult> {
  const redis = await getRedisConnection();
  const sourceKey = buildTimeSeriesKey(organizationId, metric, sourceGranularity);
  const targetKey = buildTimeSeriesKey(organizationId, metric, targetGranularity);

  let pointsProcessed = 0;
  let pointsCreated = 0;

  if (sourceGranularity === 'raw') {
    // Downsample raw data to aggregated
    const rawPoints = await redis.zrangebyscore(
      sourceKey,
      dateRange.start.getTime(),
      dateRange.end.getTime()
    );

    const aggregated = aggregateRawPoints(rawPoints, targetGranularity);
    pointsProcessed = rawPoints.length;

    for (const [period, data] of Object.entries(aggregated)) {
      await writeAggregatedPoint(
        organizationId,
        metric,
        targetGranularity,
        period,
        data.sum,
        data.count,
        data.min,
        data.max
      );
      pointsCreated++;
    }
  } else {
    // Downsample aggregated data
    const sourceData = await redis.hgetall(sourceKey);

    const aggregated = aggregatePeriodicData(sourceData, sourceGranularity, targetGranularity);
    pointsProcessed = Object.keys(sourceData).length;

    for (const [period, data] of Object.entries(aggregated)) {
      await writeAggregatedPoint(
        organizationId,
        metric,
        targetGranularity,
        period,
        data.sum,
        data.count,
        data.min,
        data.max
      );
      pointsCreated++;
    }
  }

  return {
    sourceGranularity,
    targetGranularity,
    pointsProcessed,
    pointsCreated,
  };
}

/**
 * Run automatic downsampling for all metrics
 */
export async function runAutoDownsample(organizationId: string): Promise<void> {
  const redis = await getRedisConnection();

  // Get all metrics for this organization
  const indexKey = `${TS_INDEX_PREFIX}${organizationId}`;
  const metrics = await redis.smembers(indexKey);

  for (const metric of metrics) {
    // Downsample based on rules
    for (const [source, target] of Object.entries(DEFAULT_CONFIG.aggregationRules)) {
      if (target) {
        const now = new Date();
        const dateRange: DateRange = {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          end: now,
        };

        try {
          await downsample(
            organizationId,
            metric,
            source as TimeGranularity,
            target as TimeGranularity,
            dateRange
          );
        } catch (error) {
          log.warn('Downsampling failed', {
            organizationId,
            metric,
            source,
            target,
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAINTENANCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean up expired time series data
 */
export async function cleanupExpiredData(organizationId: string): Promise<{
  keysDeleted: number;
  pointsDeleted: number;
}> {
  const redis = await getRedisConnection();
  let keysDeleted = 0;
  let pointsDeleted = 0;

  const indexKey = `${TS_INDEX_PREFIX}${organizationId}`;
  const metrics = await redis.smembers(indexKey);

  for (const metric of metrics) {
    // Clean raw data beyond retention
    const rawKey = buildTimeSeriesKey(organizationId, metric, 'raw');
    const cutoff = Date.now() - DEFAULT_CONFIG.retentionPolicies.raw * 1000;

    const removed = await redis.zremrangebyscore(rawKey, '-inf', cutoff);
    pointsDeleted += removed;

    // Check if key is empty and delete
    const remaining = await redis.zcard(rawKey);
    if (remaining === 0) {
      await redis.del(rawKey);
      keysDeleted++;
    }
  }

  return { keysDeleted, pointsDeleted };
}

/**
 * Get storage statistics
 */
export async function getStorageStats(organizationId: string): Promise<{
  totalMetrics: number;
  totalPoints: number;
  storageByGranularity: Record<string, number>;
}> {
  const redis = await getRedisConnection();

  const indexKey = `${TS_INDEX_PREFIX}${organizationId}`;
  const metrics = await redis.smembers(indexKey);

  let totalPoints = 0;
  const storageByGranularity: Record<string, number> = {};

  for (const metric of metrics) {
    // Count raw points
    const rawKey = buildTimeSeriesKey(organizationId, metric, 'raw');
    const rawCount = await redis.zcard(rawKey);
    totalPoints += rawCount;
    storageByGranularity['raw'] = (storageByGranularity['raw'] || 0) + rawCount;

    // Count aggregated points
    for (const granularity of ['hour', 'day', 'week', 'month'] as TimeGranularity[]) {
      const aggKey = buildTimeSeriesKey(organizationId, metric, granularity);
      const aggCount = await redis.hlen(aggKey);
      totalPoints += aggCount;
      storageByGranularity[granularity] = (storageByGranularity[granularity] || 0) + aggCount;
    }
  }

  return {
    totalMetrics: metrics.length,
    totalPoints,
    storageByGranularity,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function buildTimeSeriesKey(
  organizationId: string,
  metric: string,
  granularity: TimeGranularity | 'raw'
): string {
  return `${TS_KEY_PREFIX}${organizationId}:${metric}:${granularity}`;
}

async function updateIndex(
  organizationId: string,
  metric: string,
  tags?: Record<string, string>
): Promise<void> {
  const redis = await getRedisConnection();
  const indexKey = `${TS_INDEX_PREFIX}${organizationId}`;

  await redis.sadd(indexKey, metric);

  if (tags) {
    const tagIndexKey = `${TS_INDEX_PREFIX}${organizationId}:${metric}:tags`;
    for (const [key, value] of Object.entries(tags)) {
      await redis.sadd(tagIndexKey, `${key}:${value}`);
    }
  }
}

function filterAndTransformAggregatedData(
  data: Record<string, string>,
  startTime: Date,
  endTime: Date,
  granularity: TimeGranularity
): TimeSeriesDataPoint[] {
  const points: TimeSeriesDataPoint[] = [];

  for (const [period, jsonData] of Object.entries(data)) {
    try {
      const parsed = JSON.parse(jsonData);
      const periodDate = parsePeriodToDate(period, granularity);

      if (periodDate && periodDate >= startTime && periodDate <= endTime) {
        points.push({
          timestamp: periodDate,
          value: parsed.avg || parsed.value,
          label: period,
        });
      }
    } catch {
      // Skip invalid entries
    }
  }

  return points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function transformRawData(
  rawPoints: string[],
  granularity: TimeGranularity,
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' = 'avg'
): TimeSeriesDataPoint[] {
  const buckets = new Map<string, number[]>();

  for (const pointJson of rawPoints) {
    try {
      const point: TimeSeriesPoint = JSON.parse(pointJson);
      const period = formatTimestamp(point.timestamp, granularity);

      const bucket = buckets.get(period) || [];
      bucket.push(point.value);
      buckets.set(period, bucket);
    } catch {
      // Skip invalid entries
    }
  }

  const points: TimeSeriesDataPoint[] = [];

  for (const [period, values] of buckets) {
    let value: number;

    switch (aggregation) {
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'min':
        value = Math.min(...values);
        break;
      case 'max':
        value = Math.max(...values);
        break;
      case 'count':
        value = values.length;
        break;
    }

    points.push({
      timestamp: parsePeriodToDate(period, granularity) || new Date(),
      value,
      label: period,
    });
  }

  return points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function aggregateRawPoints(
  rawPoints: string[],
  targetGranularity: TimeGranularity
): Record<string, { sum: number; count: number; min: number; max: number }> {
  const result: Record<string, { sum: number; count: number; min: number; max: number }> = {};

  for (const pointJson of rawPoints) {
    try {
      const point: TimeSeriesPoint = JSON.parse(pointJson);
      const period = formatTimestamp(point.timestamp, targetGranularity);

      if (!result[period]) {
        result[period] = { sum: 0, count: 0, min: point.value, max: point.value };
      }

      result[period].sum += point.value;
      result[period].count++;
      result[period].min = Math.min(result[period].min, point.value);
      result[period].max = Math.max(result[period].max, point.value);
    } catch {
      // Skip invalid entries
    }
  }

  return result;
}

function aggregatePeriodicData(
  sourceData: Record<string, string>,
  sourceGranularity: TimeGranularity,
  targetGranularity: TimeGranularity
): Record<string, { sum: number; count: number; min: number; max: number }> {
  const result: Record<string, { sum: number; count: number; min: number; max: number }> = {};

  for (const [period, jsonData] of Object.entries(sourceData)) {
    try {
      const parsed = JSON.parse(jsonData);
      const date = parsePeriodToDate(period, sourceGranularity);

      if (!date) continue;

      const targetPeriod = formatTimestamp(date.getTime(), targetGranularity);

      if (!result[targetPeriod]) {
        result[targetPeriod] = {
          sum: 0,
          count: 0,
          min: parsed.min ?? parsed.value,
          max: parsed.max ?? parsed.value,
        };
      }

      result[targetPeriod].sum += parsed.value * (parsed.count || 1);
      result[targetPeriod].count += parsed.count || 1;
      result[targetPeriod].min = Math.min(result[targetPeriod].min, parsed.min ?? parsed.value);
      result[targetPeriod].max = Math.max(result[targetPeriod].max, parsed.max ?? parsed.value);
    } catch {
      // Skip invalid entries
    }
  }

  return result;
}

function formatTimestamp(timestamp: number, granularity: TimeGranularity): string {
  const date = new Date(timestamp);

  switch (granularity) {
    case 'hour':
      return date.toISOString().slice(0, 13);
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${weekStart.toISOString().slice(0, 10)}_W`;
    case 'month':
      return date.toISOString().slice(0, 7);
    case 'quarter':
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    case 'year':
      return date.getFullYear().toString();
  }
}

function parsePeriodToDate(period: string, granularity: TimeGranularity): Date | null {
  try {
    switch (granularity) {
      case 'hour':
        return new Date(`${period}:00:00Z`);
      case 'day':
        return new Date(`${period}T00:00:00Z`);
      case 'week':
        return new Date(`${period.replace('_W', '')}T00:00:00Z`);
      case 'month':
        return new Date(`${period}-01T00:00:00Z`);
      case 'quarter':
        const [year, q] = period.split('-Q');
        const month = (parseInt(q, 10) - 1) * 3;
        return new Date(parseInt(year, 10), month, 1);
      case 'year':
        return new Date(parseInt(period, 10), 0, 1);
      default:
        return null;
    }
  } catch {
    return null;
  }
}
