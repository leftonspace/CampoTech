/**
 * Analytics Module
 * ================
 *
 * Comprehensive API analytics and monitoring capabilities.
 * Provides usage tracking, error monitoring, alerting, and dashboards.
 */

// Types
export {
  // Time types
  TimePeriod,
  TimeGranularity,
  TimeRange,

  // Usage types
  ApiRequest,
  UsageMetrics,
  UsageSummary,
  UsageTrend,

  // Rate limit types
  RateLimitStatus,
  RateLimitEvent,
  RateLimitMetrics,
  RateLimitConfig,

  // Error types
  ErrorSeverity,
  ErrorCategory,
  ApiError,
  ErrorGroup,
  ErrorMetrics,
  ErrorTrend,

  // Alert types
  AlertChannel,
  AlertCondition,
  AlertRule,
  Alert,
  AlertNotification,

  // Dashboard types
  WidgetType,
  MetricType,
  DashboardWidget,
  Dashboard,

  // Report types
  ReportFormat,
  ReportFrequency,
  ReportConfig,
  GeneratedReport,

  // Real-time types
  RealTimeMetrics,
  HealthStatus,

  // Configuration
  AnalyticsConfig,
  DEFAULT_ANALYTICS_CONFIG,
} from './analytics.types';

// Usage Tracking Service
export {
  UsageTrackingService,
  createUsageTrackingService,
  TrackRequestOptions,
  UsageQueryOptions,
  TopEndpoint,
  TopApiKey,
} from './usage-tracking.service';

// Rate Limit Monitor Service
export {
  RateLimitMonitorService,
  createRateLimitMonitorService,
  RecordLimitEventOptions,
  RateLimitOverride,
  RateLimitAnalysis,
} from './rate-limit-monitor.service';

// Error Tracking Service
export {
  ErrorTrackingService,
  createErrorTrackingService,
  TrackErrorOptions,
  ErrorQueryOptions,
  ErrorSearchResult,
  ErrorGroupUpdateOptions,
} from './error-tracking.service';

// Alerting Service
export {
  AlertingService,
  createAlertingService,
  CreateAlertRuleOptions,
  AlertCheckResult,
  NotificationResult,
} from './alerting.service';

// Dashboard Service
export {
  DashboardService,
  createDashboardService,
  CreateDashboardOptions,
  WidgetData,
  DashboardData,
  CreateReportOptions,
} from './dashboard.service';

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED ANALYTICS SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { UsageTrackingService, createUsageTrackingService } from './usage-tracking.service';
import { RateLimitMonitorService, createRateLimitMonitorService } from './rate-limit-monitor.service';
import { ErrorTrackingService, createErrorTrackingService } from './error-tracking.service';
import { AlertingService, createAlertingService } from './alerting.service';
import { DashboardService, createDashboardService } from './dashboard.service';
import { AnalyticsConfig, DEFAULT_ANALYTICS_CONFIG } from './analytics.types';

/**
 * Unified analytics service that provides access to all analytics capabilities
 */
export class AnalyticsService {
  readonly usage: UsageTrackingService;
  readonly rateLimit: RateLimitMonitorService;
  readonly errors: ErrorTrackingService;
  readonly alerts: AlertingService;
  readonly dashboards: DashboardService;

  private pool: Pool;
  private config: AnalyticsConfig;

  constructor(pool: Pool, config: Partial<AnalyticsConfig> = {}) {
    this.pool = pool;
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };

    this.usage = createUsageTrackingService(pool, this.config);
    this.rateLimit = createRateLimitMonitorService(pool);
    this.errors = createErrorTrackingService(pool);
    this.alerts = createAlertingService(pool);
    this.dashboards = createDashboardService(pool);
  }

  /**
   * Track an API request and handle errors/rate limits automatically
   */
  async trackRequest(options: {
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
    requestId?: string;
    requestHeaders?: Record<string, string>;
    requestBody?: string;
    responseBody?: string;
  }): Promise<void> {
    // Track the request
    await this.usage.trackRequest({
      orgId: options.orgId,
      apiKeyId: options.apiKeyId,
      oauthClientId: options.oauthClientId,
      method: options.method,
      path: options.path,
      statusCode: options.statusCode,
      durationMs: options.durationMs,
      requestSize: options.requestSize,
      responseSize: options.responseSize,
      userAgent: options.userAgent,
      ipAddress: options.ipAddress,
      errorCode: options.errorCode,
      errorMessage: options.errorMessage,
    });

    // Track errors if present
    if (options.statusCode >= 400 && options.errorCode) {
      await this.errors.trackError({
        orgId: options.orgId,
        apiKeyId: options.apiKeyId,
        oauthClientId: options.oauthClientId,
        requestId: options.requestId || `req_${Date.now()}`,
        method: options.method,
        path: options.path,
        statusCode: options.statusCode,
        errorCode: options.errorCode,
        errorMessage: options.errorMessage || 'Unknown error',
        requestHeaders: options.requestHeaders,
        requestBody: options.requestBody,
        responseBody: options.responseBody,
        userAgent: options.userAgent,
        ipAddress: options.ipAddress,
      });
    }
  }

  /**
   * Record a rate limit event
   */
  async recordRateLimit(options: {
    orgId: string;
    apiKeyId?: string;
    oauthClientId?: string;
    ipAddress: string;
    endpoint: string;
    limitType: 'api_key' | 'oauth_client' | 'ip' | 'global';
    maxRequests: number;
    windowMs: number;
  }): Promise<void> {
    await this.rateLimit.recordLimitEvent(options);
  }

  /**
   * Check all alert rules for an organization
   */
  async checkAlerts(orgId: string): Promise<void> {
    await this.alerts.checkRules(orgId);
  }

  /**
   * Get a comprehensive analytics summary
   */
  async getSummary(orgId: string, period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<{
    usage: any;
    errors: any;
    rateLimits: any;
    health: any;
  }> {
    const now = new Date();
    const start = new Date();

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
    }

    const timeRange = { start, end: now };

    const [usageSummary, errorMetrics, rateLimitMetrics, health] = await Promise.all([
      this.usage.getUsageSummary(orgId, period),
      this.errors.getErrorMetrics(orgId, timeRange),
      this.rateLimit.getMetrics(orgId, timeRange),
      this.dashboards.getHealthStatus(orgId),
    ]);

    return {
      usage: usageSummary,
      errors: errorMetrics,
      rateLimits: rateLimitMetrics,
      health,
    };
  }

  /**
   * Run periodic cleanup tasks
   */
  async runMaintenance(): Promise<{
    deletedRecords: number;
  }> {
    const deletedRecords = await this.usage.cleanupOldData();

    return { deletedRecords };
  }
}

/**
 * Factory function to create the unified analytics service
 */
export function createAnalyticsService(
  pool: Pool,
  config?: Partial<AnalyticsConfig>
): AnalyticsService {
  return new AnalyticsService(pool, config);
}
