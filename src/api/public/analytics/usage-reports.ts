/**
 * Usage Reports Service
 * =====================
 *
 * Service for generating and managing API usage reports.
 * Supports multiple formats, scheduling, and delivery.
 */

import { Pool } from 'pg';
import {
  TimeRange,
  TimePeriod,
  ReportFormat,
  ReportFrequency,
  ReportConfig,
  GeneratedReport,
  UsageSummary,
  UsageMetrics,
} from './analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateReportOptions {
  orgId: string;
  name: string;
  description?: string;
  format: ReportFormat;
  frequency?: ReportFrequency;
  metrics: ReportMetricConfig[];
  filters?: ReportFilters;
  recipients?: string[];
  createdBy: string;
}

export interface ReportMetricConfig {
  type: 'requests' | 'errors' | 'latency' | 'bandwidth' | 'rate_limits' | 'top_endpoints' | 'top_api_keys';
  breakdown?: 'endpoint' | 'method' | 'status_code' | 'api_key' | 'country' | 'hour' | 'day';
  limit?: number;
}

export interface ReportFilters {
  apiKeyIds?: string[];
  endpoints?: string[];
  methods?: string[];
  statusCodes?: number[];
  countries?: string[];
}

export interface ReportGenerationResult {
  report: GeneratedReport;
  downloadUrl: string;
  expiresAt: Date;
}

export interface ScheduledReport {
  id: string;
  orgId: string;
  config: ReportConfig;
  nextRunAt: Date;
  lastRunAt?: Date;
  lastStatus?: 'success' | 'failed';
  isEnabled: boolean;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class UsageReportsService {
  constructor(private pool: Pool) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORT CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new report configuration
   */
  async createReportConfig(options: CreateReportOptions): Promise<ReportConfig> {
    const id = crypto.randomUUID();

    await this.pool.query(
      `INSERT INTO api_report_configs (
        id, org_id, name, description, format, frequency,
        metrics, filters, recipients, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        id,
        options.orgId,
        options.name,
        options.description,
        options.format,
        options.frequency,
        JSON.stringify(options.metrics),
        JSON.stringify(options.filters || {}),
        options.recipients || [],
        options.createdBy,
      ]
    );

    return this.getReportConfig(options.orgId, id);
  }

  /**
   * Get a report configuration
   */
  async getReportConfig(orgId: string, configId: string): Promise<ReportConfig> {
    const result = await this.pool.query(
      `SELECT * FROM api_report_configs WHERE org_id = $1 AND id = $2`,
      [orgId, configId]
    );

    if (!result.rows[0]) {
      throw new Error('Report config not found');
    }

    return this.mapReportConfig(result.rows[0]);
  }

  /**
   * List report configurations
   */
  async listReportConfigs(orgId: string): Promise<ReportConfig[]> {
    const result = await this.pool.query(
      `SELECT * FROM api_report_configs WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );

    return result.rows.map(row => this.mapReportConfig(row));
  }

  /**
   * Delete a report configuration
   */
  async deleteReportConfig(orgId: string, configId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM api_report_configs WHERE org_id = $1 AND id = $2`,
      [orgId, configId]
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORT GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a usage report
   */
  async generateReport(
    orgId: string,
    configId: string,
    timeRange: TimeRange
  ): Promise<ReportGenerationResult> {
    const config = await this.getReportConfig(orgId, configId);

    // Collect report data
    const reportData = await this.collectReportData(orgId, config, timeRange);

    // Generate report content
    const content = this.formatReportContent(config.format, reportData, timeRange);

    // Store generated report
    const reportId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.pool.query(
      `INSERT INTO api_generated_reports (
        id, org_id, config_id, time_range_start, time_range_end,
        format, content, file_size, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        reportId,
        orgId,
        configId,
        timeRange.start,
        timeRange.end,
        config.format,
        content,
        Buffer.byteLength(content, 'utf8'),
        expiresAt,
      ]
    );

    const report: GeneratedReport = {
      id: reportId,
      configId,
      name: config.name,
      format: config.format,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      fileSize: Buffer.byteLength(content, 'utf8'),
      generatedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    return {
      report,
      downloadUrl: `/api/v1/analytics/reports/${reportId}/download`,
      expiresAt,
    };
  }

  /**
   * Generate a quick report without saving a configuration
   */
  async generateQuickReport(
    orgId: string,
    options: {
      format: ReportFormat;
      metrics: ReportMetricConfig[];
      timeRange: TimeRange;
      filters?: ReportFilters;
    }
  ): Promise<string> {
    const config: ReportConfig = {
      id: 'quick',
      orgId,
      name: 'Quick Report',
      format: options.format,
      metrics: options.metrics as any,
      filters: options.filters as any,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    };

    const reportData = await this.collectReportData(orgId, config, options.timeRange);
    return this.formatReportContent(options.format, reportData, options.timeRange);
  }

  /**
   * Download a generated report
   */
  async downloadReport(orgId: string, reportId: string): Promise<{ content: string; format: ReportFormat; filename: string }> {
    const result = await this.pool.query(
      `SELECT * FROM api_generated_reports WHERE org_id = $1 AND id = $2 AND expires_at > NOW()`,
      [orgId, reportId]
    );

    if (!result.rows[0]) {
      throw new Error('Report not found or expired');
    }

    const row = result.rows[0];
    const config = await this.getReportConfig(orgId, row.config_id);

    const extensions: Record<ReportFormat, string> = {
      json: 'json',
      csv: 'csv',
      pdf: 'pdf',
      html: 'html',
    };

    return {
      content: row.content,
      format: row.format,
      filename: `${config.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${extensions[row.format]}`,
    };
  }

  /**
   * List generated reports
   */
  async listGeneratedReports(
    orgId: string,
    options?: { configId?: string; limit?: number }
  ): Promise<GeneratedReport[]> {
    let query = `SELECT * FROM api_generated_reports WHERE org_id = $1`;
    const params: any[] = [orgId];

    if (options?.configId) {
      query += ` AND config_id = $2`;
      params.push(options.configId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(options?.limit || 50);

    const result = await this.pool.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      configId: row.config_id,
      name: row.name || 'Report',
      format: row.format,
      timeRange: {
        start: row.time_range_start,
        end: row.time_range_end,
      },
      fileSize: row.file_size,
      generatedAt: row.created_at,
      expiresAt: row.expires_at,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCHEDULED REPORTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Schedule a report
   */
  async scheduleReport(
    orgId: string,
    configId: string,
    frequency: ReportFrequency
  ): Promise<ScheduledReport> {
    const config = await this.getReportConfig(orgId, configId);

    await this.pool.query(
      `UPDATE api_report_configs SET frequency = $3, updated_at = NOW()
       WHERE org_id = $1 AND id = $2`,
      [orgId, configId, frequency]
    );

    const nextRunAt = this.calculateNextRunTime(frequency);

    await this.pool.query(
      `INSERT INTO api_scheduled_reports (id, org_id, config_id, next_run_at, is_enabled, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (config_id) DO UPDATE SET
         next_run_at = $4,
         is_enabled = true,
         updated_at = NOW()`,
      [crypto.randomUUID(), orgId, configId, nextRunAt]
    );

    return {
      id: crypto.randomUUID(),
      orgId,
      config,
      nextRunAt,
      isEnabled: true,
      createdAt: new Date(),
    };
  }

  /**
   * Get pending scheduled reports
   */
  async getPendingScheduledReports(): Promise<ScheduledReport[]> {
    const result = await this.pool.query(
      `SELECT sr.*, rc.* FROM api_scheduled_reports sr
       JOIN api_report_configs rc ON sr.config_id = rc.id
       WHERE sr.is_enabled = true AND sr.next_run_at <= NOW()
       ORDER BY sr.next_run_at ASC`
    );

    return result.rows.map(row => ({
      id: row.id,
      orgId: row.org_id,
      config: this.mapReportConfig(row),
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
      lastStatus: row.last_status,
      isEnabled: row.is_enabled,
      createdAt: row.created_at,
    }));
  }

  /**
   * Run scheduled reports
   */
  async runScheduledReports(): Promise<number> {
    const pending = await this.getPendingScheduledReports();
    let processed = 0;

    for (const scheduled of pending) {
      try {
        const timeRange = this.getTimeRangeForFrequency(scheduled.config.frequency!);

        await this.generateReport(scheduled.orgId, scheduled.config.id, timeRange);

        // Update schedule
        const nextRunAt = this.calculateNextRunTime(scheduled.config.frequency!);
        await this.pool.query(
          `UPDATE api_scheduled_reports SET
            last_run_at = NOW(),
            last_status = 'success',
            next_run_at = $2,
            updated_at = NOW()
           WHERE id = $1`,
          [scheduled.id, nextRunAt]
        );

        // Send to recipients if configured
        if (scheduled.config.recipients && scheduled.config.recipients.length > 0) {
          // TODO: Implement email delivery
          console.log(`[Reports] Would send report to: ${scheduled.config.recipients.join(', ')}`);
        }

        processed++;
      } catch (error) {
        console.error(`[Reports] Failed to generate scheduled report ${scheduled.id}:`, error);

        await this.pool.query(
          `UPDATE api_scheduled_reports SET
            last_run_at = NOW(),
            last_status = 'failed',
            updated_at = NOW()
           WHERE id = $1`,
          [scheduled.id]
        );
      }
    }

    return processed;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private mapReportConfig(row: any): ReportConfig {
    return {
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      description: row.description,
      format: row.format,
      frequency: row.frequency,
      metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics,
      filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters,
      recipients: row.recipients,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }

  private async collectReportData(
    orgId: string,
    config: ReportConfig,
    timeRange: TimeRange
  ): Promise<any> {
    const data: any = {
      summary: await this.getUsageSummary(orgId, timeRange),
      metrics: {},
    };

    for (const metric of config.metrics) {
      switch (metric.type) {
        case 'requests':
          data.metrics.requests = await this.getRequestMetrics(orgId, timeRange, metric.breakdown);
          break;
        case 'errors':
          data.metrics.errors = await this.getErrorMetrics(orgId, timeRange);
          break;
        case 'latency':
          data.metrics.latency = await this.getLatencyMetrics(orgId, timeRange, metric.breakdown);
          break;
        case 'bandwidth':
          data.metrics.bandwidth = await this.getBandwidthMetrics(orgId, timeRange);
          break;
        case 'top_endpoints':
          data.metrics.topEndpoints = await this.getTopEndpoints(orgId, timeRange, metric.limit || 10);
          break;
        case 'top_api_keys':
          data.metrics.topApiKeys = await this.getTopApiKeys(orgId, timeRange, metric.limit || 10);
          break;
      }
    }

    return data;
  }

  private async getUsageSummary(orgId: string, timeRange: TimeRange): Promise<UsageSummary> {
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
       WHERE org_id = $1 AND timestamp >= $2 AND timestamp <= $3`,
      [orgId, timeRange.start, timeRange.end]
    );

    const row = result.rows[0];

    return {
      period: 'day',
      startDate: timeRange.start,
      endDate: timeRange.end,
      metrics: {
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
      },
      byEndpoint: {},
      byMethod: {},
      byStatusCode: {},
      byApiKey: {},
      byCountry: {},
    };
  }

  private async getRequestMetrics(orgId: string, timeRange: TimeRange, breakdown?: string): Promise<any[]> {
    let groupBy = 'DATE_TRUNC(\'hour\', timestamp)';
    if (breakdown === 'day') groupBy = 'DATE_TRUNC(\'day\', timestamp)';
    if (breakdown === 'endpoint') groupBy = 'endpoint';
    if (breakdown === 'method') groupBy = 'method';

    const result = await this.pool.query(
      `SELECT ${groupBy} as bucket, COUNT(*) as count
       FROM api_requests
       WHERE org_id = $1 AND timestamp >= $2 AND timestamp <= $3
       GROUP BY bucket ORDER BY bucket`,
      [orgId, timeRange.start, timeRange.end]
    );

    return result.rows.map(row => ({
      bucket: row.bucket,
      count: parseInt(row.count),
    }));
  }

  private async getErrorMetrics(orgId: string, timeRange: TimeRange): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT status_code, error_code, COUNT(*) as count
       FROM api_requests
       WHERE org_id = $1 AND timestamp >= $2 AND timestamp <= $3 AND status_code >= 400
       GROUP BY status_code, error_code
       ORDER BY count DESC
       LIMIT 20`,
      [orgId, timeRange.start, timeRange.end]
    );

    return result.rows;
  }

  private async getLatencyMetrics(orgId: string, timeRange: TimeRange, breakdown?: string): Promise<any[]> {
    let groupBy = 'DATE_TRUNC(\'hour\', timestamp)';
    if (breakdown === 'endpoint') groupBy = 'endpoint';

    const result = await this.pool.query(
      `SELECT ${groupBy} as bucket,
        AVG(duration_ms) as avg_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_ms
       FROM api_requests
       WHERE org_id = $1 AND timestamp >= $2 AND timestamp <= $3
       GROUP BY bucket ORDER BY bucket`,
      [orgId, timeRange.start, timeRange.end]
    );

    return result.rows;
  }

  private async getBandwidthMetrics(orgId: string, timeRange: TimeRange): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT DATE_TRUNC('hour', timestamp) as bucket,
        SUM(request_size) as request_bytes,
        SUM(response_size) as response_bytes
       FROM api_requests
       WHERE org_id = $1 AND timestamp >= $2 AND timestamp <= $3
       GROUP BY bucket ORDER BY bucket`,
      [orgId, timeRange.start, timeRange.end]
    );

    return result.rows;
  }

  private async getTopEndpoints(orgId: string, timeRange: TimeRange, limit: number): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT endpoint, method, COUNT(*) as count, AVG(duration_ms) as avg_latency
       FROM api_requests
       WHERE org_id = $1 AND timestamp >= $2 AND timestamp <= $3
       GROUP BY endpoint, method
       ORDER BY count DESC
       LIMIT $4`,
      [orgId, timeRange.start, timeRange.end, limit]
    );

    return result.rows;
  }

  private async getTopApiKeys(orgId: string, timeRange: TimeRange, limit: number): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT api_key_id, COUNT(*) as count, AVG(duration_ms) as avg_latency
       FROM api_requests
       WHERE org_id = $1 AND timestamp >= $2 AND timestamp <= $3 AND api_key_id IS NOT NULL
       GROUP BY api_key_id
       ORDER BY count DESC
       LIMIT $4`,
      [orgId, timeRange.start, timeRange.end, limit]
    );

    return result.rows;
  }

  private formatReportContent(format: ReportFormat, data: any, timeRange: TimeRange): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);

      case 'csv':
        return this.formatAsCsv(data);

      case 'html':
        return this.formatAsHtml(data, timeRange);

      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private formatAsCsv(data: any): string {
    const rows: string[] = [];

    // Summary header
    rows.push('Metric,Value');
    rows.push(`Total Requests,${data.summary.metrics.totalRequests}`);
    rows.push(`Successful Requests,${data.summary.metrics.successfulRequests}`);
    rows.push(`Failed Requests,${data.summary.metrics.failedRequests}`);
    rows.push(`Average Latency (ms),${data.summary.metrics.averageLatency.toFixed(2)}`);
    rows.push(`P95 Latency (ms),${data.summary.metrics.p95Latency.toFixed(2)}`);
    rows.push(`Total Bandwidth (bytes),${data.summary.metrics.totalBandwidth}`);
    rows.push('');

    // Top endpoints if available
    if (data.metrics.topEndpoints) {
      rows.push('Endpoint,Method,Count,Avg Latency');
      for (const ep of data.metrics.topEndpoints) {
        rows.push(`${ep.endpoint},${ep.method},${ep.count},${parseFloat(ep.avg_latency).toFixed(2)}`);
      }
    }

    return rows.join('\n');
  }

  private formatAsHtml(data: any, timeRange: TimeRange): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>API Usage Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
    h1 { color: #1a1a1a; }
    .metric-card { background: #f5f5f5; padding: 20px; margin: 10px 0; border-radius: 8px; }
    .metric-value { font-size: 32px; font-weight: bold; color: #0066cc; }
    .metric-label { color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <h1>API Usage Report</h1>
  <p>Period: ${timeRange.start.toISOString()} - ${timeRange.end.toISOString()}</p>

  <div class="metric-card">
    <div class="metric-value">${data.summary.metrics.totalRequests.toLocaleString()}</div>
    <div class="metric-label">Total Requests</div>
  </div>

  <div class="metric-card">
    <div class="metric-value">${((data.summary.metrics.successfulRequests / data.summary.metrics.totalRequests) * 100).toFixed(1)}%</div>
    <div class="metric-label">Success Rate</div>
  </div>

  <div class="metric-card">
    <div class="metric-value">${data.summary.metrics.averageLatency.toFixed(0)}ms</div>
    <div class="metric-label">Average Latency</div>
  </div>

  ${data.metrics.topEndpoints ? `
  <h2>Top Endpoints</h2>
  <table>
    <tr><th>Endpoint</th><th>Method</th><th>Requests</th><th>Avg Latency</th></tr>
    ${data.metrics.topEndpoints.map((ep: any) =>
      `<tr><td>${ep.endpoint}</td><td>${ep.method}</td><td>${ep.count}</td><td>${parseFloat(ep.avg_latency).toFixed(0)}ms</td></tr>`
    ).join('')}
  </table>
  ` : ''}

</body>
</html>`;
  }

  private calculateNextRunTime(frequency: ReportFrequency): Date {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  private getTimeRangeForFrequency(frequency: ReportFrequency): TimeRange {
    const end = new Date();
    let start: Date;

    switch (frequency) {
      case 'daily':
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate());
        break;
      default:
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createUsageReportsService(pool: Pool): UsageReportsService {
  return new UsageReportsService(pool);
}
