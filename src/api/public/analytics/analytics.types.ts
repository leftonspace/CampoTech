/**
 * API Analytics Types
 * ====================
 *
 * Type definitions for API usage tracking, monitoring, and analytics.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TIME PERIODS
// ═══════════════════════════════════════════════════════════════════════════════

export type TimePeriod = 'hour' | 'day' | 'week' | 'month' | 'year';

export type TimeGranularity = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface TimeRange {
  start: Date;
  end: Date;
  granularity?: TimeGranularity;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API USAGE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiRequest {
  id: string;
  orgId: string;
  apiKeyId?: string;
  oauthClientId?: string;
  method: string;
  path: string;
  endpoint: string;
  statusCode: number;
  durationMs: number;
  requestSize: number;
  responseSize: number;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
  region?: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}

export interface UsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  totalBandwidth: number;
  uniqueIps: number;
  uniqueApiKeys: number;
}

export interface UsageSummary {
  period: TimePeriod;
  startDate: Date;
  endDate: Date;
  metrics: UsageMetrics;
  byEndpoint: Record<string, UsageMetrics>;
  byMethod: Record<string, UsageMetrics>;
  byStatusCode: Record<number, number>;
  byApiKey: Record<string, UsageMetrics>;
  byCountry: Record<string, number>;
}

export interface UsageTrend {
  timestamp: Date;
  requests: number;
  errors: number;
  latency: number;
  bandwidth: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitStatus {
  apiKeyId?: string;
  oauthClientId?: string;
  ipAddress?: string;
  windowMs: number;
  maxRequests: number;
  currentRequests: number;
  remainingRequests: number;
  resetAt: Date;
  isLimited: boolean;
}

export interface RateLimitEvent {
  id: string;
  orgId: string;
  apiKeyId?: string;
  oauthClientId?: string;
  ipAddress: string;
  endpoint: string;
  limitType: 'api_key' | 'oauth_client' | 'ip' | 'global';
  maxRequests: number;
  windowMs: number;
  timestamp: Date;
}

export interface RateLimitMetrics {
  totalLimitEvents: number;
  uniqueApiKeysLimited: number;
  uniqueIpsLimited: number;
  byEndpoint: Record<string, number>;
  byApiKey: Record<string, number>;
  byHour: number[];
}

export interface RateLimitConfig {
  id: string;
  orgId: string;
  apiKeyId?: string;
  endpoint?: string;
  windowMs: number;
  maxRequests: number;
  burstLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'rate_limit'
  | 'not_found'
  | 'conflict'
  | 'internal'
  | 'external_service'
  | 'timeout'
  | 'unknown';

export interface ApiError {
  id: string;
  orgId: string;
  apiKeyId?: string;
  oauthClientId?: string;
  requestId: string;
  method: string;
  path: string;
  endpoint: string;
  statusCode: number;
  errorCode: string;
  errorMessage: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  stackTrace?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
}

export interface ErrorGroup {
  id: string;
  orgId: string;
  errorCode: string;
  endpoint: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  firstSeen: Date;
  lastSeen: Date;
  occurrences: number;
  uniqueApiKeys: number;
  uniqueIps: number;
  sampleErrorId: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'ignored';
  assignee?: string;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  byStatusCode: Record<number, number>;
  byEndpoint: Record<string, number>;
  topErrors: Array<{
    errorCode: string;
    count: number;
    lastSeen: Date;
  }>;
}

export interface ErrorTrend {
  timestamp: Date;
  total: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTING
// ═══════════════════════════════════════════════════════════════════════════════

export type AlertChannel = 'email' | 'slack' | 'webhook' | 'pagerduty' | 'sms';

export type AlertCondition =
  | 'error_rate_threshold'
  | 'latency_threshold'
  | 'rate_limit_reached'
  | 'error_spike'
  | 'traffic_spike'
  | 'traffic_drop'
  | 'new_error_type';

export interface AlertRule {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  condition: AlertCondition;
  threshold: number;
  windowMinutes: number;
  endpoint?: string;
  apiKeyId?: string;
  channels: AlertChannel[];
  recipients: string[];
  webhookUrl?: string;
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Alert {
  id: string;
  orgId: string;
  ruleId: string;
  ruleName: string;
  condition: AlertCondition;
  threshold: number;
  actualValue: number;
  message: string;
  severity: ErrorSeverity;
  metadata: Record<string, any>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  channel: AlertChannel;
  recipient: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARDS
// ═══════════════════════════════════════════════════════════════════════════════

export type WidgetType =
  | 'counter'
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'table'
  | 'heatmap'
  | 'gauge'
  | 'sparkline';

export type MetricType =
  | 'requests'
  | 'errors'
  | 'latency'
  | 'bandwidth'
  | 'rate_limits'
  | 'active_keys'
  | 'unique_ips';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  metric: MetricType;
  timeRange: TimePeriod;
  granularity?: TimeGranularity;
  filters?: {
    endpoint?: string;
    apiKeyId?: string;
    statusCode?: number;
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config?: Record<string, any>;
}

export interface Dashboard {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  isDefault: boolean;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type ReportFormat = 'json' | 'csv' | 'pdf';

export type ReportFrequency = 'daily' | 'weekly' | 'monthly';

export interface ReportConfig {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  type: 'usage' | 'errors' | 'performance' | 'security';
  format: ReportFormat;
  timeRange: TimePeriod;
  frequency?: ReportFrequency;
  recipients: string[];
  filters?: {
    apiKeyIds?: string[];
    endpoints?: string[];
    statusCodes?: number[];
  };
  enabled: boolean;
  lastGenerated?: Date;
  nextScheduled?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedReport {
  id: string;
  configId: string;
  orgId: string;
  name: string;
  type: string;
  format: ReportFormat;
  timeRange: TimeRange;
  data: any;
  downloadUrl?: string;
  expiresAt: Date;
  generatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-TIME METRICS
// ═══════════════════════════════════════════════════════════════════════════════

export interface RealTimeMetrics {
  timestamp: Date;
  requestsPerSecond: number;
  errorsPerSecond: number;
  averageLatencyMs: number;
  activeConnections: number;
  bandwidthBytesPerSecond: number;
  topEndpoints: Array<{
    endpoint: string;
    requestsPerSecond: number;
  }>;
  recentErrors: Array<{
    errorCode: string;
    count: number;
  }>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCheck: Date;
  components: {
    api: 'up' | 'down';
    database: 'up' | 'down';
    cache: 'up' | 'down';
    webhooks: 'up' | 'down';
  };
  metrics: {
    errorRate: number;
    averageLatency: number;
    p99Latency: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnalyticsConfig {
  retentionDays: number;
  aggregationIntervals: TimeGranularity[];
  enableRealTimeMetrics: boolean;
  enableGeoTracking: boolean;
  samplingRate: number; // 0-1, for high-traffic APIs
  excludePaths: string[];
  sensitiveHeaders: string[];
}

export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  retentionDays: 90,
  aggregationIntervals: ['minute', 'hour', 'day'],
  enableRealTimeMetrics: true,
  enableGeoTracking: true,
  samplingRate: 1.0,
  excludePaths: ['/health', '/ready', '/metrics'],
  sensitiveHeaders: ['authorization', 'x-api-key', 'cookie'],
};
