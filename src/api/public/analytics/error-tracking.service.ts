/**
 * Error Tracking Service
 * ======================
 *
 * Service for tracking, categorizing, and analyzing API errors.
 * Provides error grouping, severity assessment, and trending.
 */

import { Pool } from 'pg';
import {
  ApiError,
  ErrorGroup,
  ErrorMetrics,
  ErrorTrend,
  ErrorCategory,
  ErrorSeverity,
  TimeRange,
  TimeGranularity,
} from './analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrackErrorOptions {
  orgId: string;
  apiKeyId?: string;
  oauthClientId?: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  errorCode: string;
  errorMessage: string;
  stackTrace?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface ErrorQueryOptions {
  orgId: string;
  apiKeyId?: string;
  endpoint?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  resolved?: boolean;
  timeRange: TimeRange;
  limit?: number;
  offset?: number;
}

export interface ErrorSearchResult {
  errors: ApiError[];
  total: number;
  hasMore: boolean;
}

export interface ErrorGroupUpdateOptions {
  status?: 'open' | 'acknowledged' | 'resolved' | 'ignored';
  assignee?: string;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CATEGORIZATION
// ═══════════════════════════════════════════════════════════════════════════════

const ERROR_CATEGORY_MAP: Record<number, ErrorCategory> = {
  400: 'validation',
  401: 'authentication',
  403: 'authorization',
  404: 'not_found',
  409: 'conflict',
  429: 'rate_limit',
  500: 'internal',
  502: 'external_service',
  503: 'external_service',
  504: 'timeout',
};

const ERROR_CODE_SEVERITY: Record<string, ErrorSeverity> = {
  INTERNAL_ERROR: 'critical',
  DATABASE_ERROR: 'critical',
  EXTERNAL_SERVICE_TIMEOUT: 'high',
  EXTERNAL_SERVICE_ERROR: 'high',
  AUTHENTICATION_FAILED: 'medium',
  AUTHORIZATION_DENIED: 'medium',
  RATE_LIMIT_EXCEEDED: 'low',
  VALIDATION_ERROR: 'low',
  NOT_FOUND: 'low',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ErrorTrackingService {
  private pool: Pool;
  private sensitiveHeaders: string[] = [
    'authorization',
    'x-api-key',
    'cookie',
    'set-cookie',
  ];

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR TRACKING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Track an API error
   */
  async trackError(options: TrackErrorOptions): Promise<ApiError> {
    const {
      orgId,
      apiKeyId,
      oauthClientId,
      requestId,
      method,
      path,
      statusCode,
      errorCode,
      errorMessage,
      stackTrace,
      requestHeaders,
      requestBody,
      responseBody,
      userAgent,
      ipAddress,
    } = options;

    const endpoint = this.extractEndpoint(path);
    const category = this.categorizeError(statusCode, errorCode);
    const severity = this.assessSeverity(errorCode, statusCode);
    const errorId = this.generateErrorId();
    const sanitizedHeaders = this.sanitizeHeaders(requestHeaders || {});

    await this.pool.query(
      `INSERT INTO api_errors (
        id, org_id, api_key_id, oauth_client_id,
        request_id, method, path, endpoint,
        status_code, error_code, error_message,
        category, severity, stack_trace,
        request_headers, request_body, response_body,
        user_agent, ip_address, created_at,
        resolved
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17,
        $18, $19, NOW(),
        false
      )`,
      [
        errorId,
        orgId,
        apiKeyId || null,
        oauthClientId || null,
        requestId,
        method,
        path,
        endpoint,
        statusCode,
        errorCode,
        errorMessage,
        category,
        severity,
        stackTrace || null,
        JSON.stringify(sanitizedHeaders),
        requestBody ? requestBody.substring(0, 10000) : null,
        responseBody ? responseBody.substring(0, 10000) : null,
        userAgent || null,
        ipAddress || null,
      ]
    );

    // Update or create error group
    await this.updateErrorGroup(orgId, errorCode, endpoint, category, severity, errorId);

    return {
      id: errorId,
      orgId,
      apiKeyId,
      oauthClientId,
      requestId,
      method,
      path,
      endpoint,
      statusCode,
      errorCode,
      errorMessage,
      category,
      severity,
      stackTrace,
      requestHeaders: sanitizedHeaders,
      requestBody,
      responseBody,
      userAgent,
      ipAddress,
      timestamp: new Date(),
      resolved: false,
    };
  }

  /**
   * Get an error by ID
   */
  async getError(orgId: string, errorId: string): Promise<ApiError | null> {
    const result = await this.pool.query(
      `SELECT * FROM api_errors WHERE id = $1 AND org_id = $2`,
      [errorId, orgId]
    );

    if (result.rows.length === 0) return null;

    return this.mapErrorRow(result.rows[0]);
  }

  /**
   * Search errors with filters
   */
  async searchErrors(options: ErrorQueryOptions): Promise<ErrorSearchResult> {
    const {
      orgId,
      apiKeyId,
      endpoint,
      category,
      severity,
      resolved,
      timeRange,
      limit = 50,
      offset = 0,
    } = options;

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
    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }
    if (severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(severity);
    }
    if (resolved !== undefined) {
      conditions.push(`resolved = $${paramIndex++}`);
      params.push(resolved);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM api_errors WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get errors
    const result = await this.pool.query(
      `SELECT * FROM api_errors
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const errors = result.rows.map(this.mapErrorRow);

    return {
      errors,
      total,
      hasMore: offset + errors.length < total,
    };
  }

  /**
   * Resolve an error
   */
  async resolveError(
    orgId: string,
    errorId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE api_errors
      SET resolved = true, resolved_at = NOW(), resolved_by = $1, notes = $2
      WHERE id = $3 AND org_id = $4`,
      [resolvedBy, notes || null, errorId, orgId]
    );
    return (result.rowCount || 0) > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR GROUPS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get error groups for an organization
   */
  async getErrorGroups(
    orgId: string,
    timeRange: TimeRange,
    options?: {
      status?: string;
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ groups: ErrorGroup[]; total: number }> {
    const conditions: string[] = ['org_id = $1', 'last_seen >= $2'];
    const params: any[] = [orgId, timeRange.start];
    let paramIndex = 3;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }
    if (options?.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(options.category);
    }
    if (options?.severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(options.severity);
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM error_groups WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await this.pool.query(
      `SELECT * FROM error_groups
      WHERE ${whereClause}
      ORDER BY occurrences DESC, last_seen DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const groups: ErrorGroup[] = result.rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      errorCode: row.error_code,
      endpoint: row.endpoint,
      category: row.category,
      severity: row.severity,
      firstSeen: new Date(row.first_seen),
      lastSeen: new Date(row.last_seen),
      occurrences: parseInt(row.occurrences),
      uniqueApiKeys: parseInt(row.unique_api_keys),
      uniqueIps: parseInt(row.unique_ips),
      sampleErrorId: row.sample_error_id,
      status: row.status,
      assignee: row.assignee,
    }));

    return { groups, total };
  }

  /**
   * Update an error group
   */
  async updateErrorGroup(
    orgId: string,
    groupId: string,
    updates: ErrorGroupUpdateOptions
  ): Promise<ErrorGroup | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.status) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }
    if (updates.assignee !== undefined) {
      setClauses.push(`assignee = $${paramIndex++}`);
      params.push(updates.assignee || null);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      params.push(updates.notes || null);
    }

    params.push(groupId, orgId);

    const result = await this.pool.query(
      `UPDATE error_groups
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
      RETURNING *`,
      params
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      orgId: row.org_id,
      errorCode: row.error_code,
      endpoint: row.endpoint,
      category: row.category,
      severity: row.severity,
      firstSeen: new Date(row.first_seen),
      lastSeen: new Date(row.last_seen),
      occurrences: parseInt(row.occurrences),
      uniqueApiKeys: parseInt(row.unique_api_keys),
      uniqueIps: parseInt(row.unique_ips),
      sampleErrorId: row.sample_error_id,
      status: row.status,
      assignee: row.assignee,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR METRICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get error metrics for a time range
   */
  async getErrorMetrics(orgId: string, timeRange: TimeRange): Promise<ErrorMetrics> {
    // Total errors
    const totalResult = await this.pool.query(
      `SELECT COUNT(*) FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [orgId, timeRange.start, timeRange.end]
    );
    const totalErrors = parseInt(totalResult.rows[0].count) || 0;

    // Total requests for error rate calculation
    const requestsResult = await this.pool.query(
      `SELECT COUNT(*) FROM api_requests
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [orgId, timeRange.start, timeRange.end]
    );
    const totalRequests = parseInt(requestsResult.rows[0].count) || 1;
    const errorRate = totalErrors / totalRequests;

    // By category
    const categoryResult = await this.pool.query(
      `SELECT category, COUNT(*) as count FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY category`,
      [orgId, timeRange.start, timeRange.end]
    );
    const byCategory: Record<ErrorCategory, number> = {
      authentication: 0,
      authorization: 0,
      validation: 0,
      rate_limit: 0,
      not_found: 0,
      conflict: 0,
      internal: 0,
      external_service: 0,
      timeout: 0,
      unknown: 0,
    };
    for (const row of categoryResult.rows) {
      byCategory[row.category as ErrorCategory] = parseInt(row.count);
    }

    // By severity
    const severityResult = await this.pool.query(
      `SELECT severity, COUNT(*) as count FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY severity`,
      [orgId, timeRange.start, timeRange.end]
    );
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    for (const row of severityResult.rows) {
      bySeverity[row.severity as ErrorSeverity] = parseInt(row.count);
    }

    // By status code
    const statusResult = await this.pool.query(
      `SELECT status_code, COUNT(*) as count FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY status_code`,
      [orgId, timeRange.start, timeRange.end]
    );
    const byStatusCode: Record<number, number> = {};
    for (const row of statusResult.rows) {
      byStatusCode[row.status_code] = parseInt(row.count);
    }

    // By endpoint
    const endpointResult = await this.pool.query(
      `SELECT endpoint, COUNT(*) as count FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY endpoint`,
      [orgId, timeRange.start, timeRange.end]
    );
    const byEndpoint: Record<string, number> = {};
    for (const row of endpointResult.rows) {
      byEndpoint[row.endpoint] = parseInt(row.count);
    }

    // Top errors
    const topErrorsResult = await this.pool.query(
      `SELECT error_code, COUNT(*) as count, MAX(created_at) as last_seen
      FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY error_code
      ORDER BY count DESC
      LIMIT 10`,
      [orgId, timeRange.start, timeRange.end]
    );
    const topErrors = topErrorsResult.rows.map((row) => ({
      errorCode: row.error_code,
      count: parseInt(row.count),
      lastSeen: new Date(row.last_seen),
    }));

    return {
      totalErrors,
      errorRate,
      byCategory,
      bySeverity,
      byStatusCode,
      byEndpoint,
      topErrors,
    };
  }

  /**
   * Get error trends over time
   */
  async getErrorTrends(
    orgId: string,
    timeRange: TimeRange,
    granularity?: TimeGranularity
  ): Promise<ErrorTrend[]> {
    const grain = granularity || this.determineGranularity(timeRange);
    const truncFunc = this.getTimeTruncFunction(grain);

    const result = await this.pool.query(
      `SELECT
        ${truncFunc}(created_at) as timestamp,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE category = 'authentication') as auth_errors,
        COUNT(*) FILTER (WHERE category = 'authorization') as authz_errors,
        COUNT(*) FILTER (WHERE category = 'validation') as validation_errors,
        COUNT(*) FILTER (WHERE category = 'rate_limit') as rate_limit_errors,
        COUNT(*) FILTER (WHERE category = 'not_found') as not_found_errors,
        COUNT(*) FILTER (WHERE category = 'internal') as internal_errors,
        COUNT(*) FILTER (WHERE category = 'external_service') as external_errors,
        COUNT(*) FILTER (WHERE category = 'timeout') as timeout_errors,
        COUNT(*) FILTER (WHERE severity = 'low') as low_severity,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium_severity,
        COUNT(*) FILTER (WHERE severity = 'high') as high_severity,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_severity
      FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY ${truncFunc}(created_at)
      ORDER BY timestamp`,
      [orgId, timeRange.start, timeRange.end]
    );

    return result.rows.map((row) => ({
      timestamp: new Date(row.timestamp),
      total: parseInt(row.total),
      byCategory: {
        authentication: parseInt(row.auth_errors),
        authorization: parseInt(row.authz_errors),
        validation: parseInt(row.validation_errors),
        rate_limit: parseInt(row.rate_limit_errors),
        not_found: parseInt(row.not_found_errors),
        conflict: 0,
        internal: parseInt(row.internal_errors),
        external_service: parseInt(row.external_errors),
        timeout: parseInt(row.timeout_errors),
        unknown: 0,
      },
      bySeverity: {
        low: parseInt(row.low_severity),
        medium: parseInt(row.medium_severity),
        high: parseInt(row.high_severity),
        critical: parseInt(row.critical_severity),
      },
    }));
  }

  /**
   * Detect error spikes
   */
  async detectErrorSpikes(
    orgId: string,
    windowMinutes: number = 5,
    threshold: number = 2.0
  ): Promise<{
    hasSpike: boolean;
    currentRate: number;
    averageRate: number;
    spikeMultiplier: number;
    topErrors: Array<{ errorCode: string; count: number }>;
  }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
    const compareStart = new Date(windowStart.getTime() - 60 * 60 * 1000); // 1 hour before

    // Current window error count
    const currentResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [orgId, windowStart, now]
    );
    const currentCount = parseInt(currentResult.rows[0].count) || 0;
    const currentRate = currentCount / windowMinutes;

    // Average rate from previous hour
    const historicalResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at < $3`,
      [orgId, compareStart, windowStart]
    );
    const historicalCount = parseInt(historicalResult.rows[0].count) || 0;
    const averageRate = historicalCount / 60; // per minute

    const spikeMultiplier = averageRate > 0 ? currentRate / averageRate : 0;
    const hasSpike = spikeMultiplier >= threshold;

    // Top errors in current window
    const topErrorsResult = await this.pool.query(
      `SELECT error_code, COUNT(*) as count FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY error_code
      ORDER BY count DESC
      LIMIT 5`,
      [orgId, windowStart, now]
    );
    const topErrors = topErrorsResult.rows.map((row) => ({
      errorCode: row.error_code,
      count: parseInt(row.count),
    }));

    return {
      hasSpike,
      currentRate,
      averageRate,
      spikeMultiplier,
      topErrors,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private generateErrorId(): string {
    return `err_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateGroupId(): string {
    return `erg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private extractEndpoint(path: string): string {
    return path.replace(/\/[a-z]+_[a-zA-Z0-9]+/g, '/{id}').replace(/\/\d+/g, '/{id}');
  }

  private categorizeError(statusCode: number, errorCode: string): ErrorCategory {
    // Check status code mapping first
    if (ERROR_CATEGORY_MAP[statusCode]) {
      return ERROR_CATEGORY_MAP[statusCode];
    }

    // Infer from error code
    const code = errorCode.toUpperCase();
    if (code.includes('AUTH') && code.includes('FAIL')) return 'authentication';
    if (code.includes('PERMISSION') || code.includes('FORBIDDEN')) return 'authorization';
    if (code.includes('VALID')) return 'validation';
    if (code.includes('RATE') || code.includes('LIMIT')) return 'rate_limit';
    if (code.includes('NOT_FOUND')) return 'not_found';
    if (code.includes('CONFLICT') || code.includes('DUPLICATE')) return 'conflict';
    if (code.includes('TIMEOUT')) return 'timeout';
    if (code.includes('EXTERNAL') || code.includes('UPSTREAM')) return 'external_service';
    if (statusCode >= 500) return 'internal';

    return 'unknown';
  }

  private assessSeverity(errorCode: string, statusCode: number): ErrorSeverity {
    // Check explicit mapping
    if (ERROR_CODE_SEVERITY[errorCode]) {
      return ERROR_CODE_SEVERITY[errorCode];
    }

    // Infer from status code
    if (statusCode >= 500) return 'high';
    if (statusCode === 429) return 'low';
    if (statusCode >= 400 && statusCode < 500) return 'medium';

    return 'low';
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (this.sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private async updateErrorGroup(
    orgId: string,
    errorCode: string,
    endpoint: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    sampleErrorId: string
  ): Promise<void> {
    const groupId = this.generateGroupId();

    try {
      await this.pool.query(
        `INSERT INTO error_groups (
          id, org_id, error_code, endpoint,
          category, severity, first_seen, last_seen,
          occurrences, unique_api_keys, unique_ips,
          sample_error_id, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, NOW(), NOW(),
          1, 1, 1,
          $7, 'open', NOW(), NOW()
        )
        ON CONFLICT (org_id, error_code, endpoint)
        DO UPDATE SET
          last_seen = NOW(),
          occurrences = error_groups.occurrences + 1,
          sample_error_id = $7,
          updated_at = NOW()`,
        [groupId, orgId, errorCode, endpoint, category, severity, sampleErrorId]
      );
    } catch (error) {
      console.error('[ErrorTracking] Failed to update error group:', error);
    }
  }

  private mapErrorRow(row: any): ApiError {
    return {
      id: row.id,
      orgId: row.org_id,
      apiKeyId: row.api_key_id,
      oauthClientId: row.oauth_client_id,
      requestId: row.request_id,
      method: row.method,
      path: row.path,
      endpoint: row.endpoint,
      statusCode: row.status_code,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      category: row.category,
      severity: row.severity,
      stackTrace: row.stack_trace,
      requestHeaders: row.request_headers ? JSON.parse(row.request_headers) : undefined,
      requestBody: row.request_body,
      responseBody: row.response_body,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      timestamp: new Date(row.created_at),
      resolved: row.resolved,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolvedBy: row.resolved_by,
      notes: row.notes,
    };
  }

  private determineGranularity(timeRange: TimeRange): TimeGranularity {
    const diffMs = timeRange.end.getTime() - timeRange.start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 6) return 'minute';
    if (diffHours <= 72) return 'hour';
    if (diffHours <= 720) return 'day';
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createErrorTrackingService(pool: Pool): ErrorTrackingService {
  return new ErrorTrackingService(pool);
}
