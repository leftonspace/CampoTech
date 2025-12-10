/**
 * Usage Tracking Service
 * ======================
 *
 * Service for tracking and analyzing API usage patterns.
 * Provides metrics, trends, and usage summaries.
 */

import { Pool } from 'pg';
import {
  ApiRequest,
  UsageMetrics,
  UsageSummary,
  UsageTrend,
  TimeRange,
  TimePeriod,
  TimeGranularity,
  AnalyticsConfig,
  DEFAULT_ANALYTICS_CONFIG,
} from './analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrackRequestOptions {
  orgId: string;
  apiKeyId?: string;
  oauthClientId?: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestSize?: number;
  responseSize?: number;
  userAgent?: string;
  ipAddress?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface UsageQueryOptions {
  orgId: string;
  apiKeyId?: string;
  oauthClientId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  timeRange: TimeRange;
}

export interface TopEndpoint {
  endpoint: string;
  method: string;
  requestCount: number;
  avgLatency: number;
  errorRate: number;
}

export interface TopApiKey {
  apiKeyId: string;
  keyName?: string;
  requestCount: number;
  avgLatency: number;
  errorRate: number;
  lastUsed: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class UsageTrackingService {
  private pool: Pool;
  private config: AnalyticsConfig;
  private geoCache: Map<string, { country: string; region: string }> = new Map();

  constructor(pool: Pool, config: Partial<AnalyticsConfig> = {}) {
    this.pool = pool;
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REQUEST TRACKING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Track an API request
   */
  async trackRequest(options: TrackRequestOptions): Promise<void> {
    const {
      orgId,
      apiKeyId,
      oauthClientId,
      method,
      path,
      statusCode,
      durationMs,
      requestSize = 0,
      responseSize = 0,
      userAgent,
      ipAddress,
      errorCode,
      errorMessage,
    } = options;

    // Check if path should be excluded
    if (this.shouldExcludePath(path)) {
      return;
    }

    // Apply sampling if configured
    if (this.config.samplingRate < 1.0 && Math.random() > this.config.samplingRate) {
      return;
    }

    // Extract endpoint pattern from path
    const endpoint = this.extractEndpoint(path);

    // Get geo info if enabled
    let country: string | undefined;
    let region: string | undefined;
    if (this.config.enableGeoTracking && ipAddress) {
      const geoInfo = await this.getGeoInfo(ipAddress);
      country = geoInfo?.country;
      region = geoInfo?.region;
    }

    const requestId = this.generateRequestId();

    try {
      await this.pool.query(
        `INSERT INTO api_requests (
          id, org_id, api_key_id, oauth_client_id,
          method, path, endpoint, status_code,
          duration_ms, request_size, response_size,
          user_agent, ip_address, country, region,
          error_code, error_message, created_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, NOW()
        )`,
        [
          requestId,
          orgId,
          apiKeyId || null,
          oauthClientId || null,
          method,
          path,
          endpoint,
          statusCode,
          durationMs,
          requestSize,
          responseSize,
          userAgent || null,
          ipAddress || null,
          country || null,
          region || null,
          errorCode || null,
          errorMessage || null,
        ]
      );

      // Update aggregated metrics asynchronously
      this.updateAggregatedMetrics(orgId, endpoint, method, statusCode, durationMs).catch(
        console.error
      );
    } catch (error) {
      console.error('[UsageTracking] Failed to track request:', error);
    }
  }

  /**
   * Bulk track multiple requests
   */
  async trackRequestsBatch(requests: TrackRequestOptions[]): Promise<void> {
    if (requests.length === 0) return;

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const req of requests) {
      if (this.shouldExcludePath(req.path)) continue;
      if (this.config.samplingRate < 1.0 && Math.random() > this.config.samplingRate) continue;

      const endpoint = this.extractEndpoint(req.path);
      const requestId = this.generateRequestId();

      placeholders.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
          `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
          `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ` +
          `$${paramIndex++}, $${paramIndex++}, $${paramIndex++}, NOW())`
      );

      values.push(
        requestId,
        req.orgId,
        req.apiKeyId || null,
        req.oauthClientId || null,
        req.method,
        req.path,
        endpoint,
        req.statusCode,
        req.durationMs,
        req.requestSize || 0,
        req.responseSize || 0,
        req.userAgent || null,
        req.ipAddress || null,
        req.errorCode || null
      );
    }

    if (placeholders.length === 0) return;

    try {
      await this.pool.query(
        `INSERT INTO api_requests (
          id, org_id, api_key_id, oauth_client_id,
          method, path, endpoint, status_code,
          duration_ms, request_size, response_size,
          user_agent, ip_address, error_code, created_at
        ) VALUES ${placeholders.join(', ')}`,
        values
      );
    } catch (error) {
      console.error('[UsageTracking] Failed to batch track requests:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // USAGE METRICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get usage metrics for a time range
   */
  async getUsageMetrics(options: UsageQueryOptions): Promise<UsageMetrics> {
    const { orgId, apiKeyId, oauthClientId, endpoint, method, timeRange } = options;

    const conditions: string[] = ['org_id = $1', 'created_at >= $2', 'created_at <= $3'];
    const params: any[] = [orgId, timeRange.start, timeRange.end];
    let paramIndex = 4;

    if (apiKeyId) {
      conditions.push(`api_key_id = $${paramIndex++}`);
      params.push(apiKeyId);
    }
    if (oauthClientId) {
      conditions.push(`oauth_client_id = $${paramIndex++}`);
      params.push(oauthClientId);
    }
    if (endpoint) {
      conditions.push(`endpoint = $${paramIndex++}`);
      params.push(endpoint);
    }
    if (method) {
      conditions.push(`method = $${paramIndex++}`);
      params.push(method);
    }

    const whereClause = conditions.join(' AND ');

    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code < 400) as successful_requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
        AVG(duration_ms) as avg_latency,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as p50_latency,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_latency,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_latency,
        SUM(request_size + response_size) as total_bandwidth,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT api_key_id) as unique_api_keys
      FROM api_requests
      WHERE ${whereClause}`,
      params
    );

    const row = result.rows[0];
    return {
      totalRequests: parseInt(row.total_requests) || 0,
      successfulRequests: parseInt(row.successful_requests) || 0,
      failedRequests: parseInt(row.failed_requests) || 0,
      averageLatency: parseFloat(row.avg_latency) || 0,
      p50Latency: parseFloat(row.p50_latency) || 0,
      p95Latency: parseFloat(row.p95_latency) || 0,
      p99Latency: parseFloat(row.p99_latency) || 0,
      totalBandwidth: parseInt(row.total_bandwidth) || 0,
      uniqueIps: parseInt(row.unique_ips) || 0,
      uniqueApiKeys: parseInt(row.unique_api_keys) || 0,
    };
  }

  /**
   * Get usage summary with breakdowns
   */
  async getUsageSummary(
    orgId: string,
    period: TimePeriod,
    startDate?: Date
  ): Promise<UsageSummary> {
    const timeRange = this.calculateTimeRange(period, startDate);

    // Get overall metrics
    const metrics = await this.getUsageMetrics({ orgId, timeRange });

    // Get breakdown by endpoint
    const endpointResult = await this.pool.query(
      `SELECT
        endpoint,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code < 400) as successful_requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
        AVG(duration_ms) as avg_latency
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY endpoint`,
      [orgId, timeRange.start, timeRange.end]
    );

    const byEndpoint: Record<string, UsageMetrics> = {};
    for (const row of endpointResult.rows) {
      byEndpoint[row.endpoint] = {
        totalRequests: parseInt(row.total_requests),
        successfulRequests: parseInt(row.successful_requests),
        failedRequests: parseInt(row.failed_requests),
        averageLatency: parseFloat(row.avg_latency),
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        totalBandwidth: 0,
        uniqueIps: 0,
        uniqueApiKeys: 0,
      };
    }

    // Get breakdown by method
    const methodResult = await this.pool.query(
      `SELECT
        method,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code < 400) as successful_requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
        AVG(duration_ms) as avg_latency
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY method`,
      [orgId, timeRange.start, timeRange.end]
    );

    const byMethod: Record<string, UsageMetrics> = {};
    for (const row of methodResult.rows) {
      byMethod[row.method] = {
        totalRequests: parseInt(row.total_requests),
        successfulRequests: parseInt(row.successful_requests),
        failedRequests: parseInt(row.failed_requests),
        averageLatency: parseFloat(row.avg_latency),
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        totalBandwidth: 0,
        uniqueIps: 0,
        uniqueApiKeys: 0,
      };
    }

    // Get breakdown by status code
    const statusResult = await this.pool.query(
      `SELECT status_code, COUNT(*) as count
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY status_code`,
      [orgId, timeRange.start, timeRange.end]
    );

    const byStatusCode: Record<number, number> = {};
    for (const row of statusResult.rows) {
      byStatusCode[row.status_code] = parseInt(row.count);
    }

    // Get breakdown by API key
    const apiKeyResult = await this.pool.query(
      `SELECT
        api_key_id,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code < 400) as successful_requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
        AVG(duration_ms) as avg_latency
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3 AND api_key_id IS NOT NULL
      GROUP BY api_key_id`,
      [orgId, timeRange.start, timeRange.end]
    );

    const byApiKey: Record<string, UsageMetrics> = {};
    for (const row of apiKeyResult.rows) {
      byApiKey[row.api_key_id] = {
        totalRequests: parseInt(row.total_requests),
        successfulRequests: parseInt(row.successful_requests),
        failedRequests: parseInt(row.failed_requests),
        averageLatency: parseFloat(row.avg_latency),
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        totalBandwidth: 0,
        uniqueIps: 0,
        uniqueApiKeys: 0,
      };
    }

    // Get breakdown by country
    const countryResult = await this.pool.query(
      `SELECT country, COUNT(*) as count
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3 AND country IS NOT NULL
      GROUP BY country`,
      [orgId, timeRange.start, timeRange.end]
    );

    const byCountry: Record<string, number> = {};
    for (const row of countryResult.rows) {
      byCountry[row.country] = parseInt(row.count);
    }

    return {
      period,
      startDate: timeRange.start,
      endDate: timeRange.end,
      metrics,
      byEndpoint,
      byMethod,
      byStatusCode,
      byApiKey,
      byCountry,
    };
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(options: UsageQueryOptions): Promise<UsageTrend[]> {
    const { orgId, apiKeyId, endpoint, timeRange } = options;
    const granularity = timeRange.granularity || this.determineGranularity(timeRange);

    const conditions: string[] = ['org_id = $1', 'created_at >= $2', 'created_at <= $3'];
    const params: any[] = [orgId, timeRange.start, timeRange.end];
    let paramIndex = 4;

    if (apiKeyId) {
      conditions.push(`api_key_id = $${paramIndex++}`);
      params.push(apiKeyId);
    }
    if (endpoint) {
      conditions.push(`endpoint = $${paramIndex++}`);
      params.push(endpoint);
    }

    const truncFunc = this.getTimeTruncFunction(granularity);

    const result = await this.pool.query(
      `SELECT
        ${truncFunc}(created_at) as timestamp,
        COUNT(*) as requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as errors,
        AVG(duration_ms) as latency,
        SUM(request_size + response_size) as bandwidth
      FROM api_requests
      WHERE ${conditions.join(' AND ')}
      GROUP BY ${truncFunc}(created_at)
      ORDER BY timestamp`,
      params
    );

    return result.rows.map((row) => ({
      timestamp: new Date(row.timestamp),
      requests: parseInt(row.requests),
      errors: parseInt(row.errors),
      latency: parseFloat(row.latency) || 0,
      bandwidth: parseInt(row.bandwidth) || 0,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TOP ENTITIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get top endpoints by request count
   */
  async getTopEndpoints(
    orgId: string,
    timeRange: TimeRange,
    limit: number = 10
  ): Promise<TopEndpoint[]> {
    const result = await this.pool.query(
      `SELECT
        endpoint,
        method,
        COUNT(*) as request_count,
        AVG(duration_ms) as avg_latency,
        (COUNT(*) FILTER (WHERE status_code >= 400))::float / NULLIF(COUNT(*), 0) as error_rate
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY endpoint, method
      ORDER BY request_count DESC
      LIMIT $4`,
      [orgId, timeRange.start, timeRange.end, limit]
    );

    return result.rows.map((row) => ({
      endpoint: row.endpoint,
      method: row.method,
      requestCount: parseInt(row.request_count),
      avgLatency: parseFloat(row.avg_latency) || 0,
      errorRate: parseFloat(row.error_rate) || 0,
    }));
  }

  /**
   * Get top API keys by usage
   */
  async getTopApiKeys(
    orgId: string,
    timeRange: TimeRange,
    limit: number = 10
  ): Promise<TopApiKey[]> {
    const result = await this.pool.query(
      `SELECT
        r.api_key_id,
        k.name as key_name,
        COUNT(*) as request_count,
        AVG(r.duration_ms) as avg_latency,
        (COUNT(*) FILTER (WHERE r.status_code >= 400))::float / NULLIF(COUNT(*), 0) as error_rate,
        MAX(r.created_at) as last_used
      FROM api_requests r
      LEFT JOIN api_keys k ON r.api_key_id = k.id
      WHERE r.org_id = $1 AND r.created_at >= $2 AND r.created_at <= $3 AND r.api_key_id IS NOT NULL
      GROUP BY r.api_key_id, k.name
      ORDER BY request_count DESC
      LIMIT $4`,
      [orgId, timeRange.start, timeRange.end, limit]
    );

    return result.rows.map((row) => ({
      apiKeyId: row.api_key_id,
      keyName: row.key_name,
      requestCount: parseInt(row.request_count),
      avgLatency: parseFloat(row.avg_latency) || 0,
      errorRate: parseFloat(row.error_rate) || 0,
      lastUsed: new Date(row.last_used),
    }));
  }

  /**
   * Get slowest endpoints
   */
  async getSlowestEndpoints(
    orgId: string,
    timeRange: TimeRange,
    limit: number = 10
  ): Promise<TopEndpoint[]> {
    const result = await this.pool.query(
      `SELECT
        endpoint,
        method,
        COUNT(*) as request_count,
        AVG(duration_ms) as avg_latency,
        (COUNT(*) FILTER (WHERE status_code >= 400))::float / NULLIF(COUNT(*), 0) as error_rate
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY endpoint, method
      HAVING COUNT(*) >= 10
      ORDER BY avg_latency DESC
      LIMIT $4`,
      [orgId, timeRange.start, timeRange.end, limit]
    );

    return result.rows.map((row) => ({
      endpoint: row.endpoint,
      method: row.method,
      requestCount: parseInt(row.request_count),
      avgLatency: parseFloat(row.avg_latency) || 0,
      errorRate: parseFloat(row.error_rate) || 0,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Clean up old data based on retention policy
   */
  async cleanupOldData(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const result = await this.pool.query(
      `DELETE FROM api_requests WHERE created_at < $1`,
      [cutoffDate]
    );

    return result.rowCount || 0;
  }

  /**
   * Get data size statistics
   */
  async getDataStats(orgId: string): Promise<{
    totalRecords: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
    estimatedSizeBytes: number;
  }> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_records,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record,
        pg_total_relation_size('api_requests') as table_size
      FROM api_requests
      WHERE org_id = $1`,
      [orgId]
    );

    const row = result.rows[0];
    return {
      totalRecords: parseInt(row.total_records) || 0,
      oldestRecord: row.oldest_record ? new Date(row.oldest_record) : null,
      newestRecord: row.newest_record ? new Date(row.newest_record) : null,
      estimatedSizeBytes: parseInt(row.table_size) || 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private shouldExcludePath(path: string): boolean {
    return this.config.excludePaths.some(
      (excludePath) => path === excludePath || path.startsWith(excludePath + '/')
    );
  }

  private extractEndpoint(path: string): string {
    // Convert /v1/customers/cust_123/jobs to /v1/customers/{id}/jobs
    return path.replace(/\/[a-z]+_[a-zA-Z0-9]+/g, '/{id}').replace(/\/\d+/g, '/{id}');
  }

  private generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private async getGeoInfo(
    ipAddress: string
  ): Promise<{ country: string; region: string } | null> {
    // Check cache first
    if (this.geoCache.has(ipAddress)) {
      return this.geoCache.get(ipAddress)!;
    }

    // In production, you would use a GeoIP service
    // For now, return null (geo info not available)
    return null;
  }

  private calculateTimeRange(period: TimePeriod, startDate?: Date): TimeRange {
    const end = startDate || new Date();
    const start = new Date(end);

    switch (period) {
      case 'hour':
        start.setHours(start.getHours() - 1);
        break;
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return { start, end };
  }

  private determineGranularity(timeRange: TimeRange): TimeGranularity {
    const diffMs = timeRange.end.getTime() - timeRange.start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 6) return 'minute';
    if (diffHours <= 72) return 'hour';
    if (diffHours <= 720) return 'day'; // 30 days
    return 'week';
  }

  private getTimeTruncFunction(granularity: TimeGranularity): string {
    switch (granularity) {
      case 'minute':
        return "date_trunc('minute', ";
      case 'hour':
        return "date_trunc('hour', ";
      case 'day':
        return "date_trunc('day', ";
      case 'week':
        return "date_trunc('week', ";
      case 'month':
        return "date_trunc('month', ";
    }
  }

  private async updateAggregatedMetrics(
    orgId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    durationMs: number
  ): Promise<void> {
    // Update hourly aggregates
    const hour = new Date();
    hour.setMinutes(0, 0, 0);

    try {
      await this.pool.query(
        `INSERT INTO api_metrics_hourly (
          org_id, endpoint, method, hour,
          request_count, error_count, total_latency_ms,
          min_latency_ms, max_latency_ms
        ) VALUES ($1, $2, $3, $4, 1, $5, $6, $6, $6)
        ON CONFLICT (org_id, endpoint, method, hour)
        DO UPDATE SET
          request_count = api_metrics_hourly.request_count + 1,
          error_count = api_metrics_hourly.error_count + $5,
          total_latency_ms = api_metrics_hourly.total_latency_ms + $6,
          min_latency_ms = LEAST(api_metrics_hourly.min_latency_ms, $6),
          max_latency_ms = GREATEST(api_metrics_hourly.max_latency_ms, $6)`,
        [orgId, endpoint, method, hour, statusCode >= 400 ? 1 : 0, durationMs]
      );
    } catch (error) {
      // Don't fail if aggregation fails
      console.error('[UsageTracking] Failed to update aggregates:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createUsageTrackingService(
  pool: Pool,
  config?: Partial<AnalyticsConfig>
): UsageTrackingService {
  return new UsageTrackingService(pool, config);
}
