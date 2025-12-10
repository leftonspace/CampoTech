/**
 * Rate Limit Monitor Service
 * ==========================
 *
 * Service for monitoring and managing API rate limits.
 * Tracks limit events, provides metrics, and manages configurations.
 */

import { Pool } from 'pg';
import {
  RateLimitStatus,
  RateLimitEvent,
  RateLimitMetrics,
  RateLimitConfig,
  TimeRange,
} from './analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RecordLimitEventOptions {
  orgId: string;
  apiKeyId?: string;
  oauthClientId?: string;
  ipAddress: string;
  endpoint: string;
  limitType: 'api_key' | 'oauth_client' | 'ip' | 'global';
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitOverride {
  id: string;
  orgId: string;
  apiKeyId?: string;
  endpoint?: string;
  windowMs: number;
  maxRequests: number;
  burstLimit?: number;
  reason?: string;
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string;
}

export interface RateLimitAnalysis {
  orgId: string;
  timeRange: TimeRange;
  totalLimitEvents: number;
  averageLimitEventsPerHour: number;
  peakHour: { hour: number; count: number } | null;
  mostLimitedApiKeys: Array<{ apiKeyId: string; count: number }>;
  mostLimitedEndpoints: Array<{ endpoint: string; count: number }>;
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class RateLimitMonitorService {
  private pool: Pool;
  private statusCache: Map<string, RateLimitStatus> = new Map();
  private cacheExpiryMs: number = 1000; // 1 second cache

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RATE LIMIT EVENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record a rate limit event
   */
  async recordLimitEvent(options: RecordLimitEventOptions): Promise<void> {
    const {
      orgId,
      apiKeyId,
      oauthClientId,
      ipAddress,
      endpoint,
      limitType,
      maxRequests,
      windowMs,
    } = options;

    const eventId = this.generateEventId();

    try {
      await this.pool.query(
        `INSERT INTO rate_limit_events (
          id, org_id, api_key_id, oauth_client_id,
          ip_address, endpoint, limit_type,
          max_requests, window_ms, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          eventId,
          orgId,
          apiKeyId || null,
          oauthClientId || null,
          ipAddress,
          endpoint,
          limitType,
          maxRequests,
          windowMs,
        ]
      );

      // Invalidate cache
      this.invalidateCache(apiKeyId, oauthClientId, ipAddress);
    } catch (error) {
      console.error('[RateLimitMonitor] Failed to record event:', error);
    }
  }

  /**
   * Get rate limit events for an organization
   */
  async getLimitEvents(
    orgId: string,
    timeRange: TimeRange,
    options?: {
      apiKeyId?: string;
      endpoint?: string;
      limitType?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ events: RateLimitEvent[]; total: number }> {
    const conditions: string[] = ['org_id = $1', 'created_at >= $2', 'created_at <= $3'];
    const params: any[] = [orgId, timeRange.start, timeRange.end];
    let paramIndex = 4;

    if (options?.apiKeyId) {
      conditions.push(`api_key_id = $${paramIndex++}`);
      params.push(options.apiKeyId);
    }
    if (options?.endpoint) {
      conditions.push(`endpoint = $${paramIndex++}`);
      params.push(options.endpoint);
    }
    if (options?.limitType) {
      conditions.push(`limit_type = $${paramIndex++}`);
      params.push(options.limitType);
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM rate_limit_events WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get events
    const result = await this.pool.query(
      `SELECT * FROM rate_limit_events
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const events: RateLimitEvent[] = result.rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      apiKeyId: row.api_key_id,
      oauthClientId: row.oauth_client_id,
      ipAddress: row.ip_address,
      endpoint: row.endpoint,
      limitType: row.limit_type,
      maxRequests: row.max_requests,
      windowMs: row.window_ms,
      timestamp: new Date(row.created_at),
    }));

    return { events, total };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RATE LIMIT STATUS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get current rate limit status for an API key
   */
  async getApiKeyStatus(
    orgId: string,
    apiKeyId: string
  ): Promise<RateLimitStatus | null> {
    const cacheKey = `apikey:${apiKeyId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Get the rate limit config for this API key
    const config = await this.getEffectiveConfig(orgId, apiKeyId);
    if (!config) return null;

    // Get current request count
    const windowStart = new Date(Date.now() - config.windowMs);
    const result = await this.pool.query(
      `SELECT COUNT(*) as count
      FROM api_requests
      WHERE api_key_id = $1 AND created_at >= $2`,
      [apiKeyId, windowStart]
    );

    const currentRequests = parseInt(result.rows[0].count) || 0;
    const status: RateLimitStatus = {
      apiKeyId,
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      currentRequests,
      remainingRequests: Math.max(0, config.maxRequests - currentRequests),
      resetAt: new Date(windowStart.getTime() + config.windowMs),
      isLimited: currentRequests >= config.maxRequests,
    };

    this.setInCache(cacheKey, status);
    return status;
  }

  /**
   * Get current rate limit status for an IP address
   */
  async getIpStatus(
    orgId: string,
    ipAddress: string
  ): Promise<RateLimitStatus | null> {
    const cacheKey = `ip:${ipAddress}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Get the rate limit config for this org (IP-based)
    const config = await this.getEffectiveConfig(orgId);
    if (!config) return null;

    // Get current request count
    const windowStart = new Date(Date.now() - config.windowMs);
    const result = await this.pool.query(
      `SELECT COUNT(*) as count
      FROM api_requests
      WHERE org_id = $1 AND ip_address = $2 AND created_at >= $3`,
      [orgId, ipAddress, windowStart]
    );

    const currentRequests = parseInt(result.rows[0].count) || 0;
    const status: RateLimitStatus = {
      ipAddress,
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      currentRequests,
      remainingRequests: Math.max(0, config.maxRequests - currentRequests),
      resetAt: new Date(windowStart.getTime() + config.windowMs),
      isLimited: currentRequests >= config.maxRequests,
    };

    this.setInCache(cacheKey, status);
    return status;
  }

  /**
   * Get all currently limited entities
   */
  async getCurrentlyLimited(orgId: string): Promise<{
    apiKeys: Array<{ apiKeyId: string; resetAt: Date }>;
    ips: Array<{ ipAddress: string; resetAt: Date }>;
  }> {
    // Check API keys that hit limits recently
    const apiKeyResult = await this.pool.query(
      `SELECT DISTINCT api_key_id, MAX(created_at) as last_hit
      FROM rate_limit_events
      WHERE org_id = $1
        AND api_key_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '5 minutes'
      GROUP BY api_key_id`,
      [orgId]
    );

    const apiKeys = apiKeyResult.rows.map((row) => ({
      apiKeyId: row.api_key_id,
      resetAt: new Date(new Date(row.last_hit).getTime() + 60000), // Assume 1 minute window
    }));

    // Check IPs that hit limits recently
    const ipResult = await this.pool.query(
      `SELECT DISTINCT ip_address, MAX(created_at) as last_hit
      FROM rate_limit_events
      WHERE org_id = $1
        AND created_at >= NOW() - INTERVAL '5 minutes'
      GROUP BY ip_address`,
      [orgId]
    );

    const ips = ipResult.rows.map((row) => ({
      ipAddress: row.ip_address,
      resetAt: new Date(new Date(row.last_hit).getTime() + 60000),
    }));

    return { apiKeys, ips };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RATE LIMIT METRICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get rate limit metrics for a time range
   */
  async getMetrics(orgId: string, timeRange: TimeRange): Promise<RateLimitMetrics> {
    // Total events
    const totalResult = await this.pool.query(
      `SELECT COUNT(*) as total
      FROM rate_limit_events
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [orgId, timeRange.start, timeRange.end]
    );
    const totalLimitEvents = parseInt(totalResult.rows[0].total) || 0;

    // Unique API keys limited
    const apiKeyResult = await this.pool.query(
      `SELECT COUNT(DISTINCT api_key_id) as count
      FROM rate_limit_events
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3 AND api_key_id IS NOT NULL`,
      [orgId, timeRange.start, timeRange.end]
    );
    const uniqueApiKeysLimited = parseInt(apiKeyResult.rows[0].count) || 0;

    // Unique IPs limited
    const ipResult = await this.pool.query(
      `SELECT COUNT(DISTINCT ip_address) as count
      FROM rate_limit_events
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [orgId, timeRange.start, timeRange.end]
    );
    const uniqueIpsLimited = parseInt(ipResult.rows[0].count) || 0;

    // By endpoint
    const endpointResult = await this.pool.query(
      `SELECT endpoint, COUNT(*) as count
      FROM rate_limit_events
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY endpoint`,
      [orgId, timeRange.start, timeRange.end]
    );
    const byEndpoint: Record<string, number> = {};
    for (const row of endpointResult.rows) {
      byEndpoint[row.endpoint] = parseInt(row.count);
    }

    // By API key
    const byApiKeyResult = await this.pool.query(
      `SELECT api_key_id, COUNT(*) as count
      FROM rate_limit_events
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3 AND api_key_id IS NOT NULL
      GROUP BY api_key_id`,
      [orgId, timeRange.start, timeRange.end]
    );
    const byApiKey: Record<string, number> = {};
    for (const row of byApiKeyResult.rows) {
      byApiKey[row.api_key_id] = parseInt(row.count);
    }

    // By hour of day
    const hourResult = await this.pool.query(
      `SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
      FROM rate_limit_events
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour`,
      [orgId, timeRange.start, timeRange.end]
    );
    const byHour: number[] = new Array(24).fill(0);
    for (const row of hourResult.rows) {
      byHour[parseInt(row.hour)] = parseInt(row.count);
    }

    return {
      totalLimitEvents,
      uniqueApiKeysLimited,
      uniqueIpsLimited,
      byEndpoint,
      byApiKey,
      byHour,
    };
  }

  /**
   * Analyze rate limit patterns and provide recommendations
   */
  async analyzeRateLimits(
    orgId: string,
    timeRange: TimeRange
  ): Promise<RateLimitAnalysis> {
    const metrics = await this.getMetrics(orgId, timeRange);

    // Calculate average events per hour
    const hours =
      (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60);
    const averageLimitEventsPerHour =
      hours > 0 ? metrics.totalLimitEvents / hours : 0;

    // Find peak hour
    let peakHour: { hour: number; count: number } | null = null;
    for (let i = 0; i < 24; i++) {
      if (!peakHour || metrics.byHour[i] > peakHour.count) {
        peakHour = { hour: i, count: metrics.byHour[i] };
      }
    }

    // Most limited API keys
    const mostLimitedApiKeys = Object.entries(metrics.byApiKey)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([apiKeyId, count]) => ({ apiKeyId, count }));

    // Most limited endpoints
    const mostLimitedEndpoints = Object.entries(metrics.byEndpoint)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count }));

    // Generate recommendations
    const recommendations: string[] = [];

    if (metrics.totalLimitEvents > 100 && mostLimitedApiKeys.length > 0) {
      const topKey = mostLimitedApiKeys[0];
      if (topKey.count > metrics.totalLimitEvents * 0.5) {
        recommendations.push(
          `API key ${topKey.apiKeyId} accounts for over 50% of rate limit events. ` +
            `Consider increasing its rate limit or investigating the integration.`
        );
      }
    }

    if (peakHour && peakHour.count > averageLimitEventsPerHour * 3) {
      recommendations.push(
        `Peak rate limiting occurs at hour ${peakHour.hour}:00. ` +
          `Consider implementing time-based rate limit adjustments.`
      );
    }

    if (mostLimitedEndpoints.length > 0) {
      const topEndpoint = mostLimitedEndpoints[0];
      if (topEndpoint.count > metrics.totalLimitEvents * 0.3) {
        recommendations.push(
          `Endpoint ${topEndpoint.endpoint} is frequently rate limited. ` +
            `Consider endpoint-specific rate limit increases or caching.`
        );
      }
    }

    if (metrics.uniqueIpsLimited > 50) {
      recommendations.push(
        `High number of unique IPs being rate limited (${metrics.uniqueIpsLimited}). ` +
          `This could indicate a DDoS attempt or overly aggressive limits.`
      );
    }

    if (recommendations.length === 0 && metrics.totalLimitEvents > 0) {
      recommendations.push(
        'Rate limit events are within normal parameters. No immediate action needed.'
      );
    }

    return {
      orgId,
      timeRange,
      totalLimitEvents: metrics.totalLimitEvents,
      averageLimitEventsPerHour,
      peakHour,
      mostLimitedApiKeys,
      mostLimitedEndpoints,
      recommendations,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RATE LIMIT CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create or update a rate limit configuration
   */
  async setConfig(config: Omit<RateLimitConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<RateLimitConfig> {
    const id = this.generateConfigId();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO rate_limit_configs (
        id, org_id, api_key_id, endpoint,
        window_ms, max_requests, burst_limit,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      ON CONFLICT (org_id, COALESCE(api_key_id, ''), COALESCE(endpoint, ''))
      DO UPDATE SET
        window_ms = EXCLUDED.window_ms,
        max_requests = EXCLUDED.max_requests,
        burst_limit = EXCLUDED.burst_limit,
        updated_at = $8
      RETURNING *`,
      [
        id,
        config.orgId,
        config.apiKeyId || null,
        config.endpoint || null,
        config.windowMs,
        config.maxRequests,
        config.burstLimit || null,
        now,
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      orgId: row.org_id,
      apiKeyId: row.api_key_id,
      endpoint: row.endpoint,
      windowMs: row.window_ms,
      maxRequests: row.max_requests,
      burstLimit: row.burst_limit,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Get rate limit configuration
   */
  async getConfig(
    orgId: string,
    apiKeyId?: string,
    endpoint?: string
  ): Promise<RateLimitConfig | null> {
    const result = await this.pool.query(
      `SELECT * FROM rate_limit_configs
      WHERE org_id = $1
        AND (api_key_id = $2 OR ($2 IS NULL AND api_key_id IS NULL))
        AND (endpoint = $3 OR ($3 IS NULL AND endpoint IS NULL))`,
      [orgId, apiKeyId || null, endpoint || null]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      orgId: row.org_id,
      apiKeyId: row.api_key_id,
      endpoint: row.endpoint,
      windowMs: row.window_ms,
      maxRequests: row.max_requests,
      burstLimit: row.burst_limit,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Get effective rate limit config (considering inheritance)
   */
  async getEffectiveConfig(
    orgId: string,
    apiKeyId?: string,
    endpoint?: string
  ): Promise<RateLimitConfig | null> {
    // Try specific config first (API key + endpoint)
    if (apiKeyId && endpoint) {
      const specific = await this.getConfig(orgId, apiKeyId, endpoint);
      if (specific) return specific;
    }

    // Try API key config
    if (apiKeyId) {
      const apiKeyConfig = await this.getConfig(orgId, apiKeyId);
      if (apiKeyConfig) return apiKeyConfig;
    }

    // Try endpoint config
    if (endpoint) {
      const endpointConfig = await this.getConfig(orgId, undefined, endpoint);
      if (endpointConfig) return endpointConfig;
    }

    // Fall back to org default
    return this.getConfig(orgId);
  }

  /**
   * List all rate limit configurations for an organization
   */
  async listConfigs(orgId: string): Promise<RateLimitConfig[]> {
    const result = await this.pool.query(
      `SELECT * FROM rate_limit_configs WHERE org_id = $1 ORDER BY created_at`,
      [orgId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      apiKeyId: row.api_key_id,
      endpoint: row.endpoint,
      windowMs: row.window_ms,
      maxRequests: row.max_requests,
      burstLimit: row.burst_limit,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Delete a rate limit configuration
   */
  async deleteConfig(orgId: string, configId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM rate_limit_configs WHERE id = $1 AND org_id = $2`,
      [configId, orgId]
    );
    return (result.rowCount || 0) > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private generateEventId(): string {
    return `rle_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateConfigId(): string {
    return `rlc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private getFromCache(key: string): RateLimitStatus | null {
    const cached = this.statusCache.get(key);
    if (!cached) return null;

    // Check if cache is still valid
    const cacheTime = (cached as any)._cacheTime;
    if (Date.now() - cacheTime > this.cacheExpiryMs) {
      this.statusCache.delete(key);
      return null;
    }

    return cached;
  }

  private setInCache(key: string, status: RateLimitStatus): void {
    (status as any)._cacheTime = Date.now();
    this.statusCache.set(key, status);
  }

  private invalidateCache(
    apiKeyId?: string,
    oauthClientId?: string,
    ipAddress?: string
  ): void {
    if (apiKeyId) {
      this.statusCache.delete(`apikey:${apiKeyId}`);
    }
    if (oauthClientId) {
      this.statusCache.delete(`oauth:${oauthClientId}`);
    }
    if (ipAddress) {
      this.statusCache.delete(`ip:${ipAddress}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createRateLimitMonitorService(pool: Pool): RateLimitMonitorService {
  return new RateLimitMonitorService(pool);
}
