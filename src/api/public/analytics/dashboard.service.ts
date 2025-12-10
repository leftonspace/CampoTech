/**
 * Dashboard Service
 * =================
 *
 * Service for managing API analytics dashboards and widgets.
 * Provides real-time metrics, customizable dashboards, and data exports.
 */

import { Pool } from 'pg';
import {
  Dashboard,
  DashboardWidget,
  WidgetType,
  MetricType,
  TimePeriod,
  TimeGranularity,
  TimeRange,
  RealTimeMetrics,
  HealthStatus,
  ReportConfig,
  GeneratedReport,
  ReportFormat,
  ReportFrequency,
} from './analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateDashboardOptions {
  orgId: string;
  name: string;
  description?: string;
  widgets?: DashboardWidget[];
  isDefault?: boolean;
  isPublic?: boolean;
  createdBy: string;
}

export interface WidgetData {
  widgetId: string;
  type: WidgetType;
  title: string;
  data: any;
  lastUpdated: Date;
}

export interface DashboardData {
  dashboard: Dashboard;
  widgets: WidgetData[];
  generatedAt: Date;
}

export interface CreateReportOptions {
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class DashboardService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DASHBOARDS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new dashboard
   */
  async createDashboard(options: CreateDashboardOptions): Promise<Dashboard> {
    const {
      orgId,
      name,
      description,
      widgets = [],
      isDefault = false,
      isPublic = false,
      createdBy,
    } = options;

    const dashboardId = this.generateDashboardId();
    const now = new Date();

    // If setting as default, unset any existing default
    if (isDefault) {
      await this.pool.query(
        `UPDATE dashboards SET is_default = false WHERE org_id = $1 AND is_default = true`,
        [orgId]
      );
    }

    await this.pool.query(
      `INSERT INTO dashboards (
        id, org_id, name, description,
        widgets, is_default, is_public,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [
        dashboardId,
        orgId,
        name,
        description || null,
        JSON.stringify(widgets),
        isDefault,
        isPublic,
        createdBy,
        now,
      ]
    );

    return {
      id: dashboardId,
      orgId,
      name,
      description,
      widgets,
      isDefault,
      isPublic,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get a dashboard by ID
   */
  async getDashboard(orgId: string, dashboardId: string): Promise<Dashboard | null> {
    const result = await this.pool.query(
      `SELECT * FROM dashboards WHERE id = $1 AND org_id = $2`,
      [dashboardId, orgId]
    );

    if (result.rows.length === 0) return null;
    return this.mapDashboardRow(result.rows[0]);
  }

  /**
   * Get the default dashboard for an organization
   */
  async getDefaultDashboard(orgId: string): Promise<Dashboard | null> {
    const result = await this.pool.query(
      `SELECT * FROM dashboards WHERE org_id = $1 AND is_default = true`,
      [orgId]
    );

    if (result.rows.length === 0) {
      // Create a default dashboard if none exists
      return this.createDefaultDashboard(orgId);
    }

    return this.mapDashboardRow(result.rows[0]);
  }

  /**
   * List all dashboards for an organization
   */
  async listDashboards(orgId: string): Promise<Dashboard[]> {
    const result = await this.pool.query(
      `SELECT * FROM dashboards WHERE org_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [orgId]
    );

    return result.rows.map(this.mapDashboardRow);
  }

  /**
   * Update a dashboard
   */
  async updateDashboard(
    orgId: string,
    dashboardId: string,
    updates: Partial<Omit<CreateDashboardOptions, 'orgId' | 'createdBy'>>
  ): Promise<Dashboard | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(updates.description || null);
    }
    if (updates.widgets) {
      setClauses.push(`widgets = $${paramIndex++}`);
      params.push(JSON.stringify(updates.widgets));
    }
    if (updates.isDefault !== undefined) {
      if (updates.isDefault) {
        // Unset existing default
        await this.pool.query(
          `UPDATE dashboards SET is_default = false WHERE org_id = $1 AND is_default = true`,
          [orgId]
        );
      }
      setClauses.push(`is_default = $${paramIndex++}`);
      params.push(updates.isDefault);
    }
    if (updates.isPublic !== undefined) {
      setClauses.push(`is_public = $${paramIndex++}`);
      params.push(updates.isPublic);
    }

    params.push(dashboardId, orgId);

    const result = await this.pool.query(
      `UPDATE dashboards SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
      RETURNING *`,
      params
    );

    if (result.rows.length === 0) return null;
    return this.mapDashboardRow(result.rows[0]);
  }

  /**
   * Delete a dashboard
   */
  async deleteDashboard(orgId: string, dashboardId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM dashboards WHERE id = $1 AND org_id = $2`,
      [dashboardId, orgId]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Add a widget to a dashboard
   */
  async addWidget(
    orgId: string,
    dashboardId: string,
    widget: Omit<DashboardWidget, 'id'>
  ): Promise<DashboardWidget | null> {
    const dashboard = await this.getDashboard(orgId, dashboardId);
    if (!dashboard) return null;

    const widgetWithId: DashboardWidget = {
      ...widget,
      id: this.generateWidgetId(),
    };

    dashboard.widgets.push(widgetWithId);

    await this.updateDashboard(orgId, dashboardId, { widgets: dashboard.widgets });

    return widgetWithId;
  }

  /**
   * Update a widget in a dashboard
   */
  async updateWidget(
    orgId: string,
    dashboardId: string,
    widgetId: string,
    updates: Partial<DashboardWidget>
  ): Promise<DashboardWidget | null> {
    const dashboard = await this.getDashboard(orgId, dashboardId);
    if (!dashboard) return null;

    const widgetIndex = dashboard.widgets.findIndex((w) => w.id === widgetId);
    if (widgetIndex === -1) return null;

    const updatedWidget = { ...dashboard.widgets[widgetIndex], ...updates };
    dashboard.widgets[widgetIndex] = updatedWidget;

    await this.updateDashboard(orgId, dashboardId, { widgets: dashboard.widgets });

    return updatedWidget;
  }

  /**
   * Remove a widget from a dashboard
   */
  async removeWidget(orgId: string, dashboardId: string, widgetId: string): Promise<boolean> {
    const dashboard = await this.getDashboard(orgId, dashboardId);
    if (!dashboard) return false;

    const originalLength = dashboard.widgets.length;
    dashboard.widgets = dashboard.widgets.filter((w) => w.id !== widgetId);

    if (dashboard.widgets.length === originalLength) return false;

    await this.updateDashboard(orgId, dashboardId, { widgets: dashboard.widgets });
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WIDGET DATA
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get data for all widgets in a dashboard
   */
  async getDashboardData(orgId: string, dashboardId: string): Promise<DashboardData | null> {
    const dashboard = await this.getDashboard(orgId, dashboardId);
    if (!dashboard) return null;

    const widgetDataPromises = dashboard.widgets.map((widget) =>
      this.getWidgetData(orgId, widget)
    );

    const widgets = await Promise.all(widgetDataPromises);

    return {
      dashboard,
      widgets,
      generatedAt: new Date(),
    };
  }

  /**
   * Get data for a single widget
   */
  async getWidgetData(orgId: string, widget: DashboardWidget): Promise<WidgetData> {
    const timeRange = this.calculateTimeRange(widget.timeRange);
    let data: any;

    switch (widget.type) {
      case 'counter':
        data = await this.getCounterData(orgId, widget.metric, timeRange, widget.filters);
        break;
      case 'line_chart':
      case 'sparkline':
        data = await this.getTimeSeriesData(
          orgId,
          widget.metric,
          timeRange,
          widget.granularity,
          widget.filters
        );
        break;
      case 'bar_chart':
        data = await this.getBarChartData(orgId, widget.metric, timeRange, widget.filters);
        break;
      case 'pie_chart':
        data = await this.getPieChartData(orgId, widget.metric, timeRange, widget.filters);
        break;
      case 'table':
        data = await this.getTableData(orgId, widget.metric, timeRange, widget.filters);
        break;
      case 'gauge':
        data = await this.getGaugeData(orgId, widget.metric, timeRange, widget.filters);
        break;
      case 'heatmap':
        data = await this.getHeatmapData(orgId, widget.metric, timeRange, widget.filters);
        break;
      default:
        data = null;
    }

    return {
      widgetId: widget.id,
      type: widget.type,
      title: widget.title,
      data,
      lastUpdated: new Date(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REAL-TIME METRICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get real-time metrics snapshot
   */
  async getRealTimeMetrics(orgId: string): Promise<RealTimeMetrics> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // Requests per second
    const requestsResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM api_requests
      WHERE org_id = $1 AND created_at >= $2`,
      [orgId, oneMinuteAgo]
    );
    const requestsPerSecond = (parseInt(requestsResult.rows[0].count) || 0) / 60;

    // Errors per second
    const errorsResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM api_errors
      WHERE org_id = $1 AND created_at >= $2`,
      [orgId, oneMinuteAgo]
    );
    const errorsPerSecond = (parseInt(errorsResult.rows[0].count) || 0) / 60;

    // Average latency
    const latencyResult = await this.pool.query(
      `SELECT AVG(duration_ms) as avg_latency FROM api_requests
      WHERE org_id = $1 AND created_at >= $2`,
      [orgId, oneMinuteAgo]
    );
    const averageLatencyMs = parseFloat(latencyResult.rows[0].avg_latency) || 0;

    // Bandwidth
    const bandwidthResult = await this.pool.query(
      `SELECT SUM(request_size + response_size) as total FROM api_requests
      WHERE org_id = $1 AND created_at >= $2`,
      [orgId, oneMinuteAgo]
    );
    const bandwidthBytesPerSecond = (parseInt(bandwidthResult.rows[0].total) || 0) / 60;

    // Top endpoints
    const topEndpointsResult = await this.pool.query(
      `SELECT endpoint, COUNT(*) as count FROM api_requests
      WHERE org_id = $1 AND created_at >= $2
      GROUP BY endpoint
      ORDER BY count DESC
      LIMIT 5`,
      [orgId, oneMinuteAgo]
    );
    const topEndpoints = topEndpointsResult.rows.map((row) => ({
      endpoint: row.endpoint,
      requestsPerSecond: parseInt(row.count) / 60,
    }));

    // Recent errors
    const recentErrorsResult = await this.pool.query(
      `SELECT error_code, COUNT(*) as count FROM api_errors
      WHERE org_id = $1 AND created_at >= $2
      GROUP BY error_code
      ORDER BY count DESC
      LIMIT 5`,
      [orgId, oneMinuteAgo]
    );
    const recentErrors = recentErrorsResult.rows.map((row) => ({
      errorCode: row.error_code,
      count: parseInt(row.count),
    }));

    // Active connections (estimate based on unique IPs in last minute)
    const activeConnectionsResult = await this.pool.query(
      `SELECT COUNT(DISTINCT ip_address) as count FROM api_requests
      WHERE org_id = $1 AND created_at >= $2`,
      [orgId, oneMinuteAgo]
    );
    const activeConnections = parseInt(activeConnectionsResult.rows[0].count) || 0;

    return {
      timestamp: new Date(),
      requestsPerSecond,
      errorsPerSecond,
      averageLatencyMs,
      activeConnections,
      bandwidthBytesPerSecond,
      topEndpoints,
      recentErrors,
    };
  }

  /**
   * Get API health status
   */
  async getHealthStatus(orgId: string): Promise<HealthStatus> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Calculate error rate
    const errorRateResult = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status_code >= 400) as errors,
        COUNT(*) as total
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2`,
      [orgId, fiveMinutesAgo]
    );
    const errorRate =
      (parseInt(errorRateResult.rows[0].errors) || 0) /
      (parseInt(errorRateResult.rows[0].total) || 1);

    // Calculate latency metrics
    const latencyResult = await this.pool.query(
      `SELECT
        AVG(duration_ms) as avg_latency,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_latency
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2`,
      [orgId, fiveMinutesAgo]
    );
    const averageLatency = parseFloat(latencyResult.rows[0].avg_latency) || 0;
    const p99Latency = parseFloat(latencyResult.rows[0].p99_latency) || 0;

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 0.1 || p99Latency > 5000) {
      status = 'unhealthy';
    } else if (errorRate > 0.05 || p99Latency > 2000) {
      status = 'degraded';
    }

    // Get uptime (simplified - based on first request)
    const uptimeResult = await this.pool.query(
      `SELECT MIN(created_at) as first_request FROM api_requests WHERE org_id = $1`,
      [orgId]
    );
    const firstRequest = uptimeResult.rows[0].first_request;
    const uptime = firstRequest ? Date.now() - new Date(firstRequest).getTime() : 0;

    return {
      status,
      uptime,
      lastCheck: new Date(),
      components: {
        api: 'up',
        database: 'up',
        cache: 'up',
        webhooks: 'up',
      },
      metrics: {
        errorRate,
        averageLatency,
        p99Latency,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a report configuration
   */
  async createReport(options: CreateReportOptions): Promise<ReportConfig> {
    const {
      orgId,
      name,
      description,
      type,
      format,
      timeRange,
      frequency,
      recipients,
      filters,
    } = options;

    const reportId = this.generateReportId();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO report_configs (
        id, org_id, name, description,
        type, format, time_range, frequency,
        recipients, filters, enabled,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $11)`,
      [
        reportId,
        orgId,
        name,
        description || null,
        type,
        format,
        timeRange,
        frequency || null,
        JSON.stringify(recipients),
        JSON.stringify(filters || {}),
        now,
      ]
    );

    return {
      id: reportId,
      orgId,
      name,
      description,
      type,
      format,
      timeRange,
      frequency,
      recipients,
      filters,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Generate a report
   */
  async generateReport(
    orgId: string,
    reportId: string
  ): Promise<GeneratedReport | null> {
    const configResult = await this.pool.query(
      `SELECT * FROM report_configs WHERE id = $1 AND org_id = $2`,
      [reportId, orgId]
    );

    if (configResult.rows.length === 0) return null;

    const config = this.mapReportConfigRow(configResult.rows[0]);
    const timeRange = this.calculateTimeRange(config.timeRange);

    let data: any;

    switch (config.type) {
      case 'usage':
        data = await this.generateUsageReportData(orgId, timeRange, config.filters);
        break;
      case 'errors':
        data = await this.generateErrorReportData(orgId, timeRange, config.filters);
        break;
      case 'performance':
        data = await this.generatePerformanceReportData(orgId, timeRange, config.filters);
        break;
      case 'security':
        data = await this.generateSecurityReportData(orgId, timeRange, config.filters);
        break;
    }

    const generatedReportId = this.generateGeneratedReportId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.pool.query(
      `INSERT INTO generated_reports (
        id, config_id, org_id, name, type,
        format, time_range_start, time_range_end,
        data, expires_at, generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        generatedReportId,
        reportId,
        orgId,
        config.name,
        config.type,
        config.format,
        timeRange.start,
        timeRange.end,
        JSON.stringify(data),
        expiresAt,
      ]
    );

    // Update last generated timestamp
    await this.pool.query(
      `UPDATE report_configs SET last_generated = NOW() WHERE id = $1`,
      [reportId]
    );

    return {
      id: generatedReportId,
      configId: reportId,
      orgId,
      name: config.name,
      type: config.type,
      format: config.format,
      timeRange,
      data,
      expiresAt,
      generatedAt: new Date(),
    };
  }

  /**
   * List generated reports
   */
  async listGeneratedReports(
    orgId: string,
    options?: { configId?: string; limit?: number }
  ): Promise<GeneratedReport[]> {
    const conditions: string[] = ['org_id = $1', 'expires_at > NOW()'];
    const params: any[] = [orgId];
    let paramIndex = 2;

    if (options?.configId) {
      conditions.push(`config_id = $${paramIndex++}`);
      params.push(options.configId);
    }

    const limit = options?.limit || 20;
    params.push(limit);

    const result = await this.pool.query(
      `SELECT * FROM generated_reports
      WHERE ${conditions.join(' AND ')}
      ORDER BY generated_at DESC
      LIMIT $${paramIndex}`,
      params
    );

    return result.rows.map((row) => ({
      id: row.id,
      configId: row.config_id,
      orgId: row.org_id,
      name: row.name,
      type: row.type,
      format: row.format,
      timeRange: {
        start: new Date(row.time_range_start),
        end: new Date(row.time_range_end),
      },
      data: JSON.parse(row.data || '{}'),
      downloadUrl: row.download_url,
      expiresAt: new Date(row.expires_at),
      generatedAt: new Date(row.generated_at),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE WIDGET DATA METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private async getCounterData(
    orgId: string,
    metric: MetricType,
    timeRange: TimeRange,
    filters?: any
  ): Promise<{ value: number; change?: number; changePercent?: number }> {
    let query: string;
    let params: any[] = [orgId, timeRange.start, timeRange.end];

    switch (metric) {
      case 'requests':
        query = `SELECT COUNT(*) as value FROM api_requests
          WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`;
        break;
      case 'errors':
        query = `SELECT COUNT(*) as value FROM api_errors
          WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`;
        break;
      case 'latency':
        query = `SELECT AVG(duration_ms) as value FROM api_requests
          WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`;
        break;
      case 'bandwidth':
        query = `SELECT SUM(request_size + response_size) as value FROM api_requests
          WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`;
        break;
      case 'rate_limits':
        query = `SELECT COUNT(*) as value FROM rate_limit_events
          WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`;
        break;
      case 'active_keys':
        query = `SELECT COUNT(DISTINCT api_key_id) as value FROM api_requests
          WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`;
        break;
      case 'unique_ips':
        query = `SELECT COUNT(DISTINCT ip_address) as value FROM api_requests
          WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3`;
        break;
      default:
        return { value: 0 };
    }

    const result = await this.pool.query(query, params);
    const value = parseFloat(result.rows[0].value) || 0;

    return { value };
  }

  private async getTimeSeriesData(
    orgId: string,
    metric: MetricType,
    timeRange: TimeRange,
    granularity?: TimeGranularity,
    filters?: any
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    const grain = granularity || this.determineGranularity(timeRange);
    const truncFunc = `date_trunc('${grain}', `;

    let valueExpr: string;
    let tableName: string;

    switch (metric) {
      case 'requests':
        valueExpr = 'COUNT(*)';
        tableName = 'api_requests';
        break;
      case 'errors':
        valueExpr = 'COUNT(*)';
        tableName = 'api_errors';
        break;
      case 'latency':
        valueExpr = 'AVG(duration_ms)';
        tableName = 'api_requests';
        break;
      default:
        valueExpr = 'COUNT(*)';
        tableName = 'api_requests';
    }

    const result = await this.pool.query(
      `SELECT ${truncFunc}created_at) as timestamp, ${valueExpr} as value
      FROM ${tableName}
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY ${truncFunc}created_at)
      ORDER BY timestamp`,
      [orgId, timeRange.start, timeRange.end]
    );

    return result.rows.map((row) => ({
      timestamp: new Date(row.timestamp),
      value: parseFloat(row.value) || 0,
    }));
  }

  private async getBarChartData(
    orgId: string,
    metric: MetricType,
    timeRange: TimeRange,
    filters?: any
  ): Promise<Array<{ label: string; value: number }>> {
    let query: string;

    switch (metric) {
      case 'requests':
        query = `SELECT endpoint as label, COUNT(*) as value FROM api_requests
          WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
          GROUP BY endpoint ORDER BY value DESC LIMIT 10`;
        break;
      case 'errors':
        query = `SELECT error_code as label, COUNT(*) as value FROM api_errors
          WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
          GROUP BY error_code ORDER BY value DESC LIMIT 10`;
        break;
      default:
        query = `SELECT endpoint as label, COUNT(*) as value FROM api_requests
          WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
          GROUP BY endpoint ORDER BY value DESC LIMIT 10`;
    }

    const result = await this.pool.query(query, [orgId, timeRange.start, timeRange.end]);

    return result.rows.map((row) => ({
      label: row.label,
      value: parseInt(row.value) || 0,
    }));
  }

  private async getPieChartData(
    orgId: string,
    metric: MetricType,
    timeRange: TimeRange,
    filters?: any
  ): Promise<Array<{ label: string; value: number; percent: number }>> {
    const barData = await this.getBarChartData(orgId, metric, timeRange, filters);
    const total = barData.reduce((sum, item) => sum + item.value, 0);

    return barData.map((item) => ({
      label: item.label,
      value: item.value,
      percent: total > 0 ? (item.value / total) * 100 : 0,
    }));
  }

  private async getTableData(
    orgId: string,
    metric: MetricType,
    timeRange: TimeRange,
    filters?: any
  ): Promise<Array<Record<string, any>>> {
    const result = await this.pool.query(
      `SELECT
        endpoint,
        method,
        COUNT(*) as requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as errors,
        AVG(duration_ms) as avg_latency
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY endpoint, method
      ORDER BY requests DESC
      LIMIT 20`,
      [orgId, timeRange.start, timeRange.end]
    );

    return result.rows.map((row) => ({
      endpoint: row.endpoint,
      method: row.method,
      requests: parseInt(row.requests),
      errors: parseInt(row.errors),
      errorRate: `${((parseInt(row.errors) / parseInt(row.requests)) * 100).toFixed(1)}%`,
      avgLatency: `${parseFloat(row.avg_latency).toFixed(0)}ms`,
    }));
  }

  private async getGaugeData(
    orgId: string,
    metric: MetricType,
    timeRange: TimeRange,
    filters?: any
  ): Promise<{ value: number; min: number; max: number; thresholds: number[] }> {
    const counterData = await this.getCounterData(orgId, metric, timeRange, filters);

    // Define reasonable thresholds based on metric
    let max = 100;
    const thresholds = [25, 50, 75];

    if (metric === 'latency') {
      max = 2000; // 2 seconds
    } else if (metric === 'requests') {
      max = 10000;
    }

    return {
      value: counterData.value,
      min: 0,
      max,
      thresholds,
    };
  }

  private async getHeatmapData(
    orgId: string,
    metric: MetricType,
    timeRange: TimeRange,
    filters?: any
  ): Promise<Array<{ day: number; hour: number; value: number }>> {
    const result = await this.pool.query(
      `SELECT
        EXTRACT(DOW FROM created_at) as day,
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as value
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
      GROUP BY EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)
      ORDER BY day, hour`,
      [orgId, timeRange.start, timeRange.end]
    );

    return result.rows.map((row) => ({
      day: parseInt(row.day),
      hour: parseInt(row.hour),
      value: parseInt(row.value),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE REPORT DATA METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private async generateUsageReportData(
    orgId: string,
    timeRange: TimeRange,
    filters?: any
  ): Promise<any> {
    const totalRequests = await this.getCounterData(orgId, 'requests', timeRange);
    const uniqueIps = await this.getCounterData(orgId, 'unique_ips', timeRange);
    const activeKeys = await this.getCounterData(orgId, 'active_keys', timeRange);
    const requestsByEndpoint = await this.getBarChartData(orgId, 'requests', timeRange);
    const requestsTrend = await this.getTimeSeriesData(orgId, 'requests', timeRange);

    return {
      summary: {
        totalRequests: totalRequests.value,
        uniqueIps: uniqueIps.value,
        activeApiKeys: activeKeys.value,
      },
      byEndpoint: requestsByEndpoint,
      trend: requestsTrend,
    };
  }

  private async generateErrorReportData(
    orgId: string,
    timeRange: TimeRange,
    filters?: any
  ): Promise<any> {
    const totalErrors = await this.getCounterData(orgId, 'errors', timeRange);
    const errorsByCode = await this.getBarChartData(orgId, 'errors', timeRange);
    const errorsTrend = await this.getTimeSeriesData(orgId, 'errors', timeRange);

    return {
      summary: {
        totalErrors: totalErrors.value,
      },
      byErrorCode: errorsByCode,
      trend: errorsTrend,
    };
  }

  private async generatePerformanceReportData(
    orgId: string,
    timeRange: TimeRange,
    filters?: any
  ): Promise<any> {
    const avgLatency = await this.getCounterData(orgId, 'latency', timeRange);
    const latencyTrend = await this.getTimeSeriesData(orgId, 'latency', timeRange);
    const endpointPerformance = await this.getTableData(orgId, 'latency', timeRange);

    return {
      summary: {
        averageLatency: avgLatency.value,
      },
      trend: latencyTrend,
      byEndpoint: endpointPerformance,
    };
  }

  private async generateSecurityReportData(
    orgId: string,
    timeRange: TimeRange,
    filters?: any
  ): Promise<any> {
    const rateLimits = await this.getCounterData(orgId, 'rate_limits', timeRange);

    const authFailures = await this.pool.query(
      `SELECT COUNT(*) as count FROM api_errors
      WHERE org_id = $1 AND created_at >= $2 AND created_at <= $3
        AND category = 'authentication'`,
      [orgId, timeRange.start, timeRange.end]
    );

    return {
      summary: {
        rateLimitEvents: rateLimits.value,
        authenticationFailures: parseInt(authFailures.rows[0].count) || 0,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private generateDashboardId(): string {
    return `dash_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateWidgetId(): string {
    return `wgt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateReportId(): string {
    return `rpt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateGeneratedReportId(): string {
    return `grpt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private calculateTimeRange(period: TimePeriod): TimeRange {
    const end = new Date();
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
    if (diffHours <= 720) return 'day';
    return 'week';
  }

  private mapDashboardRow(row: any): Dashboard {
    return {
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      description: row.description,
      widgets: JSON.parse(row.widgets || '[]'),
      isDefault: row.is_default,
      isPublic: row.is_public,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapReportConfigRow(row: any): ReportConfig {
    return {
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      description: row.description,
      type: row.type,
      format: row.format,
      timeRange: row.time_range,
      frequency: row.frequency,
      recipients: JSON.parse(row.recipients || '[]'),
      filters: JSON.parse(row.filters || '{}'),
      enabled: row.enabled,
      lastGenerated: row.last_generated ? new Date(row.last_generated) : undefined,
      nextScheduled: row.next_scheduled ? new Date(row.next_scheduled) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Create a default dashboard for new organizations
   */
  private async createDefaultDashboard(orgId: string): Promise<Dashboard> {
    const defaultWidgets: DashboardWidget[] = [
      {
        id: this.generateWidgetId(),
        type: 'counter',
        title: 'Total Requests (24h)',
        metric: 'requests',
        timeRange: 'day',
        position: { x: 0, y: 0, width: 3, height: 2 },
      },
      {
        id: this.generateWidgetId(),
        type: 'counter',
        title: 'Error Count (24h)',
        metric: 'errors',
        timeRange: 'day',
        position: { x: 3, y: 0, width: 3, height: 2 },
      },
      {
        id: this.generateWidgetId(),
        type: 'counter',
        title: 'Avg Latency (24h)',
        metric: 'latency',
        timeRange: 'day',
        position: { x: 6, y: 0, width: 3, height: 2 },
      },
      {
        id: this.generateWidgetId(),
        type: 'counter',
        title: 'Active API Keys',
        metric: 'active_keys',
        timeRange: 'day',
        position: { x: 9, y: 0, width: 3, height: 2 },
      },
      {
        id: this.generateWidgetId(),
        type: 'line_chart',
        title: 'Requests Over Time',
        metric: 'requests',
        timeRange: 'week',
        granularity: 'hour',
        position: { x: 0, y: 2, width: 6, height: 4 },
      },
      {
        id: this.generateWidgetId(),
        type: 'line_chart',
        title: 'Latency Over Time',
        metric: 'latency',
        timeRange: 'week',
        granularity: 'hour',
        position: { x: 6, y: 2, width: 6, height: 4 },
      },
      {
        id: this.generateWidgetId(),
        type: 'bar_chart',
        title: 'Top Endpoints',
        metric: 'requests',
        timeRange: 'day',
        position: { x: 0, y: 6, width: 6, height: 4 },
      },
      {
        id: this.generateWidgetId(),
        type: 'pie_chart',
        title: 'Errors by Type',
        metric: 'errors',
        timeRange: 'day',
        position: { x: 6, y: 6, width: 6, height: 4 },
      },
    ];

    return this.createDashboard({
      orgId,
      name: 'API Overview',
      description: 'Default dashboard showing key API metrics',
      widgets: defaultWidgets,
      isDefault: true,
      isPublic: false,
      createdBy: 'system',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createDashboardService(pool: Pool): DashboardService {
  return new DashboardService(pool);
}
