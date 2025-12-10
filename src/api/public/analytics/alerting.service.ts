/**
 * Alerting Service
 * ================
 *
 * Service for managing API monitoring alerts and notifications.
 * Supports multiple channels and configurable alert conditions.
 */

import { Pool } from 'pg';
import {
  AlertRule,
  Alert,
  AlertNotification,
  AlertCondition,
  AlertChannel,
  ErrorSeverity,
  TimeRange,
} from './analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateAlertRuleOptions {
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
  cooldownMinutes?: number;
}

export interface AlertCheckResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  currentValue: number;
  threshold: number;
  message: string;
}

export interface NotificationResult {
  channel: AlertChannel;
  recipient: string;
  success: boolean;
  error?: string;
}

// Notification handlers type
type NotificationHandler = (
  alert: Alert,
  recipient: string,
  webhookUrl?: string
) => Promise<void>;

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class AlertingService {
  private pool: Pool;
  private notificationHandlers: Map<AlertChannel, NotificationHandler> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
    this.registerDefaultHandlers();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ALERT RULES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new alert rule
   */
  async createRule(options: CreateAlertRuleOptions): Promise<AlertRule> {
    const {
      orgId,
      name,
      description,
      condition,
      threshold,
      windowMinutes,
      endpoint,
      apiKeyId,
      channels,
      recipients,
      webhookUrl,
      cooldownMinutes = 15,
    } = options;

    const ruleId = this.generateRuleId();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO alert_rules (
        id, org_id, name, description,
        condition, threshold, window_minutes,
        endpoint, api_key_id, channels, recipients,
        webhook_url, enabled, cooldown_minutes,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10, $11,
        $12, true, $13,
        $14, $14
      )`,
      [
        ruleId,
        orgId,
        name,
        description || null,
        condition,
        threshold,
        windowMinutes,
        endpoint || null,
        apiKeyId || null,
        JSON.stringify(channels),
        JSON.stringify(recipients),
        webhookUrl || null,
        cooldownMinutes,
        now,
      ]
    );

    return {
      id: ruleId,
      orgId,
      name,
      description,
      condition,
      threshold,
      windowMinutes,
      endpoint,
      apiKeyId,
      channels,
      recipients,
      webhookUrl,
      enabled: true,
      cooldownMinutes,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get an alert rule by ID
   */
  async getRule(orgId: string, ruleId: string): Promise<AlertRule | null> {
    const result = await this.pool.query(
      `SELECT * FROM alert_rules WHERE id = $1 AND org_id = $2`,
      [ruleId, orgId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRuleRow(result.rows[0]);
  }

  /**
   * List all alert rules for an organization
   */
  async listRules(
    orgId: string,
    options?: { enabled?: boolean; condition?: AlertCondition }
  ): Promise<AlertRule[]> {
    const conditions: string[] = ['org_id = $1'];
    const params: any[] = [orgId];
    let paramIndex = 2;

    if (options?.enabled !== undefined) {
      conditions.push(`enabled = $${paramIndex++}`);
      params.push(options.enabled);
    }
    if (options?.condition) {
      conditions.push(`condition = $${paramIndex++}`);
      params.push(options.condition);
    }

    const result = await this.pool.query(
      `SELECT * FROM alert_rules WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params
    );

    return result.rows.map(this.mapRuleRow);
  }

  /**
   * Update an alert rule
   */
  async updateRule(
    orgId: string,
    ruleId: string,
    updates: Partial<Omit<CreateAlertRuleOptions, 'orgId'>>
  ): Promise<AlertRule | null> {
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
    if (updates.condition) {
      setClauses.push(`condition = $${paramIndex++}`);
      params.push(updates.condition);
    }
    if (updates.threshold !== undefined) {
      setClauses.push(`threshold = $${paramIndex++}`);
      params.push(updates.threshold);
    }
    if (updates.windowMinutes !== undefined) {
      setClauses.push(`window_minutes = $${paramIndex++}`);
      params.push(updates.windowMinutes);
    }
    if (updates.channels) {
      setClauses.push(`channels = $${paramIndex++}`);
      params.push(JSON.stringify(updates.channels));
    }
    if (updates.recipients) {
      setClauses.push(`recipients = $${paramIndex++}`);
      params.push(JSON.stringify(updates.recipients));
    }
    if (updates.webhookUrl !== undefined) {
      setClauses.push(`webhook_url = $${paramIndex++}`);
      params.push(updates.webhookUrl || null);
    }
    if (updates.cooldownMinutes !== undefined) {
      setClauses.push(`cooldown_minutes = $${paramIndex++}`);
      params.push(updates.cooldownMinutes);
    }

    params.push(ruleId, orgId);

    const result = await this.pool.query(
      `UPDATE alert_rules SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
      RETURNING *`,
      params
    );

    if (result.rows.length === 0) return null;
    return this.mapRuleRow(result.rows[0]);
  }

  /**
   * Enable or disable an alert rule
   */
  async setRuleEnabled(orgId: string, ruleId: string, enabled: boolean): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE alert_rules SET enabled = $1, updated_at = NOW()
      WHERE id = $2 AND org_id = $3`,
      [enabled, ruleId, orgId]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Delete an alert rule
   */
  async deleteRule(orgId: string, ruleId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM alert_rules WHERE id = $1 AND org_id = $2`,
      [ruleId, orgId]
    );
    return (result.rowCount || 0) > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ALERT CHECKING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check all enabled rules for an organization
   */
  async checkRules(orgId: string): Promise<AlertCheckResult[]> {
    const rules = await this.listRules(orgId, { enabled: true });
    const results: AlertCheckResult[] = [];

    for (const rule of rules) {
      const result = await this.checkRule(rule);
      results.push(result);

      if (result.triggered) {
        // Check cooldown
        if (await this.isInCooldown(rule)) {
          continue;
        }

        // Create and send alert
        const alert = await this.createAlert(rule, result.currentValue, result.message);
        await this.sendNotifications(alert, rule);
        await this.updateLastTriggered(rule.id);
      }
    }

    return results;
  }

  /**
   * Check a single rule
   */
  async checkRule(rule: AlertRule): Promise<AlertCheckResult> {
    const windowStart = new Date(Date.now() - rule.windowMinutes * 60 * 1000);
    const timeRange: TimeRange = { start: windowStart, end: new Date() };

    let currentValue = 0;
    let triggered = false;
    let message = '';

    switch (rule.condition) {
      case 'error_rate_threshold':
        currentValue = await this.calculateErrorRate(rule.orgId, timeRange, rule.endpoint);
        triggered = currentValue >= rule.threshold;
        message = `Error rate ${(currentValue * 100).toFixed(2)}% exceeds threshold ${(rule.threshold * 100).toFixed(2)}%`;
        break;

      case 'latency_threshold':
        currentValue = await this.calculateAverageLatency(rule.orgId, timeRange, rule.endpoint);
        triggered = currentValue >= rule.threshold;
        message = `Average latency ${currentValue.toFixed(0)}ms exceeds threshold ${rule.threshold}ms`;
        break;

      case 'rate_limit_reached':
        currentValue = await this.countRateLimitEvents(rule.orgId, timeRange, rule.apiKeyId);
        triggered = currentValue >= rule.threshold;
        message = `${currentValue} rate limit events (threshold: ${rule.threshold})`;
        break;

      case 'error_spike':
        const spikeResult = await this.detectErrorSpike(rule.orgId, rule.windowMinutes);
        currentValue = spikeResult.multiplier;
        triggered = currentValue >= rule.threshold;
        message = `Error spike detected: ${currentValue.toFixed(1)}x normal rate`;
        break;

      case 'traffic_spike':
        const trafficSpikeResult = await this.detectTrafficSpike(rule.orgId, rule.windowMinutes);
        currentValue = trafficSpikeResult.multiplier;
        triggered = currentValue >= rule.threshold;
        message = `Traffic spike detected: ${currentValue.toFixed(1)}x normal rate`;
        break;

      case 'traffic_drop':
        const trafficDropResult = await this.detectTrafficDrop(rule.orgId, rule.windowMinutes);
        currentValue = trafficDropResult.dropPercent;
        triggered = currentValue >= rule.threshold;
        message = `Traffic dropped ${currentValue.toFixed(1)}% below normal`;
        break;

      case 'new_error_type':
        currentValue = await this.countNewErrorTypes(rule.orgId, timeRange);
        triggered = currentValue >= rule.threshold;
        message = `${currentValue} new error type(s) detected`;
        break;
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      triggered,
      currentValue,
      threshold: rule.threshold,
      message,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ALERTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create an alert
   */
  private async createAlert(
    rule: AlertRule,
    actualValue: number,
    message: string
  ): Promise<Alert> {
    const alertId = this.generateAlertId();
    const severity = this.determineSeverity(rule.condition, actualValue, rule.threshold);
    const now = new Date();

    await this.pool.query(
      `INSERT INTO alerts (
        id, org_id, rule_id, rule_name,
        condition, threshold, actual_value,
        message, severity, metadata,
        acknowledged, resolved, created_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        false, false, $11
      )`,
      [
        alertId,
        rule.orgId,
        rule.id,
        rule.name,
        rule.condition,
        rule.threshold,
        actualValue,
        message,
        severity,
        JSON.stringify({ endpoint: rule.endpoint, apiKeyId: rule.apiKeyId }),
        now,
      ]
    );

    return {
      id: alertId,
      orgId: rule.orgId,
      ruleId: rule.id,
      ruleName: rule.name,
      condition: rule.condition,
      threshold: rule.threshold,
      actualValue,
      message,
      severity,
      metadata: { endpoint: rule.endpoint, apiKeyId: rule.apiKeyId },
      acknowledged: false,
      resolved: false,
      createdAt: now,
    };
  }

  /**
   * Get alerts for an organization
   */
  async getAlerts(
    orgId: string,
    options?: {
      ruleId?: string;
      acknowledged?: boolean;
      resolved?: boolean;
      severity?: ErrorSeverity;
      timeRange?: TimeRange;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ alerts: Alert[]; total: number }> {
    const conditions: string[] = ['org_id = $1'];
    const params: any[] = [orgId];
    let paramIndex = 2;

    if (options?.ruleId) {
      conditions.push(`rule_id = $${paramIndex++}`);
      params.push(options.ruleId);
    }
    if (options?.acknowledged !== undefined) {
      conditions.push(`acknowledged = $${paramIndex++}`);
      params.push(options.acknowledged);
    }
    if (options?.resolved !== undefined) {
      conditions.push(`resolved = $${paramIndex++}`);
      params.push(options.resolved);
    }
    if (options?.severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(options.severity);
    }
    if (options?.timeRange) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(options.timeRange.start);
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(options.timeRange.end);
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM alerts WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await this.pool.query(
      `SELECT * FROM alerts
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    const alerts = result.rows.map(this.mapAlertRow);

    return { alerts, total };
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    orgId: string,
    alertId: string,
    acknowledgedBy: string
  ): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE alerts
      SET acknowledged = true, acknowledged_at = NOW(), acknowledged_by = $1
      WHERE id = $2 AND org_id = $3`,
      [acknowledgedBy, alertId, orgId]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(orgId: string, alertId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE alerts SET resolved = true, resolved_at = NOW()
      WHERE id = $1 AND org_id = $2`,
      [alertId, orgId]
    );
    return (result.rowCount || 0) > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send notifications for an alert
   */
  async sendNotifications(alert: Alert, rule: AlertRule): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channel of rule.channels) {
      for (const recipient of rule.recipients) {
        const result = await this.sendNotification(alert, channel, recipient, rule.webhookUrl);
        results.push(result);

        // Log the notification
        await this.logNotification(alert.id, channel, recipient, result.success, result.error);
      }
    }

    return results;
  }

  /**
   * Send a single notification
   */
  private async sendNotification(
    alert: Alert,
    channel: AlertChannel,
    recipient: string,
    webhookUrl?: string
  ): Promise<NotificationResult> {
    const handler = this.notificationHandlers.get(channel);
    if (!handler) {
      return { channel, recipient, success: false, error: 'No handler for channel' };
    }

    try {
      await handler(alert, recipient, webhookUrl);
      return { channel, recipient, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { channel, recipient, success: false, error: errorMessage };
    }
  }

  /**
   * Log a notification attempt
   */
  private async logNotification(
    alertId: string,
    channel: AlertChannel,
    recipient: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    const notificationId = this.generateNotificationId();

    await this.pool.query(
      `INSERT INTO alert_notifications (
        id, alert_id, channel, recipient,
        status, sent_at, error, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        notificationId,
        alertId,
        channel,
        recipient,
        success ? 'sent' : 'failed',
        success ? new Date() : null,
        error || null,
      ]
    );
  }

  /**
   * Register a notification handler
   */
  registerNotificationHandler(channel: AlertChannel, handler: NotificationHandler): void {
    this.notificationHandlers.set(channel, handler);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METRIC CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  private async calculateErrorRate(
    orgId: string,
    timeRange: TimeRange,
    endpoint?: string
  ): Promise<number> {
    const conditions = ['org_id = $1', 'created_at >= $2', 'created_at <= $3'];
    const params = [orgId, timeRange.start, timeRange.end];

    if (endpoint) {
      conditions.push('endpoint = $4');
      params.push(endpoint);
    }

    const result = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status_code >= 400) as errors,
        COUNT(*) as total
      FROM api_requests
      WHERE ${conditions.join(' AND ')}`,
      params
    );

    const row = result.rows[0];
    const total = parseInt(row.total) || 1;
    const errors = parseInt(row.errors) || 0;
    return errors / total;
  }

  private async calculateAverageLatency(
    orgId: string,
    timeRange: TimeRange,
    endpoint?: string
  ): Promise<number> {
    const conditions = ['org_id = $1', 'created_at >= $2', 'created_at <= $3'];
    const params = [orgId, timeRange.start, timeRange.end];

    if (endpoint) {
      conditions.push('endpoint = $4');
      params.push(endpoint);
    }

    const result = await this.pool.query(
      `SELECT AVG(duration_ms) as avg_latency FROM api_requests
      WHERE ${conditions.join(' AND ')}`,
      params
    );

    return parseFloat(result.rows[0].avg_latency) || 0;
  }

  private async countRateLimitEvents(
    orgId: string,
    timeRange: TimeRange,
    apiKeyId?: string
  ): Promise<number> {
    const conditions = ['org_id = $1', 'created_at >= $2', 'created_at <= $3'];
    const params = [orgId, timeRange.start, timeRange.end];

    if (apiKeyId) {
      conditions.push('api_key_id = $4');
      params.push(apiKeyId);
    }

    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM rate_limit_events
      WHERE ${conditions.join(' AND ')}`,
      params
    );

    return parseInt(result.rows[0].count) || 0;
  }

  private async detectErrorSpike(
    orgId: string,
    windowMinutes: number
  ): Promise<{ multiplier: number }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
    const baselineStart = new Date(windowStart.getTime() - 60 * 60 * 1000);

    const result = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE created_at >= $2 AND created_at <= $3) as current_errors,
        COUNT(*) FILTER (WHERE created_at >= $4 AND created_at < $2) as baseline_errors
      FROM api_errors
      WHERE org_id = $1 AND created_at >= $4 AND created_at <= $3`,
      [orgId, windowStart, now, baselineStart]
    );

    const row = result.rows[0];
    const currentErrors = parseInt(row.current_errors) || 0;
    const baselineErrors = parseInt(row.baseline_errors) || 1;
    const baselineRate = baselineErrors / 60; // per minute
    const currentRate = currentErrors / windowMinutes;

    return { multiplier: baselineRate > 0 ? currentRate / baselineRate : 0 };
  }

  private async detectTrafficSpike(
    orgId: string,
    windowMinutes: number
  ): Promise<{ multiplier: number }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
    const baselineStart = new Date(windowStart.getTime() - 60 * 60 * 1000);

    const result = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE created_at >= $2 AND created_at <= $3) as current_requests,
        COUNT(*) FILTER (WHERE created_at >= $4 AND created_at < $2) as baseline_requests
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $4 AND created_at <= $3`,
      [orgId, windowStart, now, baselineStart]
    );

    const row = result.rows[0];
    const current = parseInt(row.current_requests) || 0;
    const baseline = parseInt(row.baseline_requests) || 1;
    const baselineRate = baseline / 60;
    const currentRate = current / windowMinutes;

    return { multiplier: baselineRate > 0 ? currentRate / baselineRate : 0 };
  }

  private async detectTrafficDrop(
    orgId: string,
    windowMinutes: number
  ): Promise<{ dropPercent: number }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
    const baselineStart = new Date(windowStart.getTime() - 60 * 60 * 1000);

    const result = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE created_at >= $2 AND created_at <= $3) as current_requests,
        COUNT(*) FILTER (WHERE created_at >= $4 AND created_at < $2) as baseline_requests
      FROM api_requests
      WHERE org_id = $1 AND created_at >= $4 AND created_at <= $3`,
      [orgId, windowStart, now, baselineStart]
    );

    const row = result.rows[0];
    const current = parseInt(row.current_requests) || 0;
    const baseline = parseInt(row.baseline_requests) || 0;

    if (baseline === 0) return { dropPercent: 0 };

    const baselineRate = baseline / 60;
    const currentRate = current / windowMinutes;
    const dropPercent = ((baselineRate - currentRate) / baselineRate) * 100;

    return { dropPercent: Math.max(0, dropPercent) };
  }

  private async countNewErrorTypes(orgId: string, timeRange: TimeRange): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(DISTINCT error_code) as new_errors
      FROM api_errors
      WHERE org_id = $1
        AND created_at >= $2
        AND created_at <= $3
        AND error_code NOT IN (
          SELECT DISTINCT error_code FROM api_errors
          WHERE org_id = $1 AND created_at < $2
        )`,
      [orgId, timeRange.start, timeRange.end]
    );

    return parseInt(result.rows[0].new_errors) || 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private generateRuleId(): string {
    return `alr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateAlertId(): string {
    return `alt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateNotificationId(): string {
    return `not_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private async isInCooldown(rule: AlertRule): Promise<boolean> {
    if (!rule.lastTriggered) return false;
    const cooldownEnd = new Date(
      rule.lastTriggered.getTime() + rule.cooldownMinutes * 60 * 1000
    );
    return new Date() < cooldownEnd;
  }

  private async updateLastTriggered(ruleId: string): Promise<void> {
    await this.pool.query(
      `UPDATE alert_rules SET last_triggered = NOW() WHERE id = $1`,
      [ruleId]
    );
  }

  private determineSeverity(
    condition: AlertCondition,
    value: number,
    threshold: number
  ): ErrorSeverity {
    const ratio = value / threshold;

    if (condition === 'error_spike' || condition === 'error_rate_threshold') {
      if (ratio >= 3) return 'critical';
      if (ratio >= 2) return 'high';
      return 'medium';
    }

    if (ratio >= 2) return 'high';
    if (ratio >= 1.5) return 'medium';
    return 'low';
  }

  private mapRuleRow(row: any): AlertRule {
    return {
      id: row.id,
      orgId: row.org_id,
      name: row.name,
      description: row.description,
      condition: row.condition,
      threshold: parseFloat(row.threshold),
      windowMinutes: parseInt(row.window_minutes),
      endpoint: row.endpoint,
      apiKeyId: row.api_key_id,
      channels: JSON.parse(row.channels || '[]'),
      recipients: JSON.parse(row.recipients || '[]'),
      webhookUrl: row.webhook_url,
      enabled: row.enabled,
      cooldownMinutes: parseInt(row.cooldown_minutes),
      lastTriggered: row.last_triggered ? new Date(row.last_triggered) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapAlertRow(row: any): Alert {
    return {
      id: row.id,
      orgId: row.org_id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      condition: row.condition,
      threshold: parseFloat(row.threshold),
      actualValue: parseFloat(row.actual_value),
      message: row.message,
      severity: row.severity,
      metadata: JSON.parse(row.metadata || '{}'),
      acknowledged: row.acknowledged,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      acknowledgedBy: row.acknowledged_by,
      resolved: row.resolved,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  private registerDefaultHandlers(): void {
    // Email handler (placeholder)
    this.notificationHandlers.set('email', async (alert, recipient) => {
      console.log(`[Alert] Sending email to ${recipient}: ${alert.message}`);
      // In production, integrate with email service
    });

    // Slack handler (placeholder)
    this.notificationHandlers.set('slack', async (alert, recipient) => {
      console.log(`[Alert] Sending Slack message to ${recipient}: ${alert.message}`);
      // In production, integrate with Slack API
    });

    // Webhook handler
    this.notificationHandlers.set('webhook', async (alert, recipient, webhookUrl) => {
      if (!webhookUrl) throw new Error('Webhook URL required');

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            ruleName: alert.ruleName,
            condition: alert.condition,
            message: alert.message,
            severity: alert.severity,
            timestamp: alert.createdAt.toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
    });

    // PagerDuty handler (placeholder)
    this.notificationHandlers.set('pagerduty', async (alert, recipient) => {
      console.log(`[Alert] Creating PagerDuty incident: ${alert.message}`);
      // In production, integrate with PagerDuty API
    });

    // SMS handler (placeholder)
    this.notificationHandlers.set('sms', async (alert, recipient) => {
      console.log(`[Alert] Sending SMS to ${recipient}: ${alert.message}`);
      // In production, integrate with SMS service (Twilio, etc.)
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createAlertingService(pool: Pool): AlertingService {
  return new AlertingService(pool);
}
