/**
 * CampoTech Alerting System (Phase 8.3.1)
 * ========================================
 *
 * Configurable alerting for critical system events.
 *
 * Supported channels:
 * - Sentry (automatic via error tracking)
 * - Slack webhooks
 * - Discord webhooks
 * - PagerDuty
 *
 * Alert types:
 * - Critical errors (500+ errors, exceptions)
 * - Performance degradation (p95 > threshold)
 * - Queue health issues (DLQ depth, SLA breaches)
 * - Business metric anomalies
 *
 * Usage:
 * ```typescript
 * import { alertManager, AlertSeverity } from '@/lib/monitoring/alerts';
 *
 * // Send a critical alert
 * await alertManager.send({
 *   severity: AlertSeverity.CRITICAL,
 *   title: 'Database connection failed',
 *   message: 'Unable to connect to primary database',
 *   context: { error: err.message },
 * });
 * ```
 */

import * as Sentry from '@sentry/nextjs';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum AlertChannel {
  SENTRY = 'sentry',
  SLACK = 'slack',
  DISCORD = 'discord',
  PAGERDUTY = 'pagerduty',
}

export interface Alert {
  severity: AlertSeverity;
  title: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp?: Date;
  source?: string;
  channels?: AlertChannel[];
}

export interface AlertThresholds {
  errorRatePercent: number;
  responseTimeMs: number;
  dlqDepth: number;
  slaCompliancePercent: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorRatePercent: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD || '5'),
  responseTimeMs: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD || '5000'),
  dlqDepth: parseInt(process.env.ALERT_DLQ_DEPTH_THRESHOLD || '100'),
  slaCompliancePercent: 95,
};

const CHANNEL_CONFIG = {
  slack: {
    enabled: !!process.env.SLACK_WEBHOOK_URL,
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
  },
  discord: {
    enabled: !!process.env.DISCORD_WEBHOOK_URL,
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
  },
  pagerduty: {
    enabled: !!process.env.PAGERDUTY_INTEGRATION_KEY,
    integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
  },
};

// Severity to PagerDuty mapping
const PAGERDUTY_SEVERITY_MAP: Record<AlertSeverity, string> = {
  [AlertSeverity.INFO]: 'info',
  [AlertSeverity.WARNING]: 'warning',
  [AlertSeverity.ERROR]: 'error',
  [AlertSeverity.CRITICAL]: 'critical',
};

// Severity to Slack color mapping
const SLACK_COLOR_MAP: Record<AlertSeverity, string> = {
  [AlertSeverity.INFO]: '#36a64f',     // Green
  [AlertSeverity.WARNING]: '#f2c744',   // Yellow
  [AlertSeverity.ERROR]: '#e01e5a',     // Red
  [AlertSeverity.CRITICAL]: '#8b0000',  // Dark red
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHANNEL SENDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send alert to Sentry
 */
async function sendToSentry(alert: Alert): Promise<void> {
  const level = alert.severity === AlertSeverity.CRITICAL ? 'fatal' : alert.severity;

  Sentry.captureMessage(`[${alert.severity.toUpperCase()}] ${alert.title}`, {
    level: level as Sentry.SeverityLevel,
    tags: {
      alertType: 'system',
      source: alert.source || 'monitoring',
    },
    extra: {
      message: alert.message,
      ...alert.context,
    },
  });
}

/**
 * Send alert to Slack
 */
async function sendToSlack(alert: Alert): Promise<void> {
  const { webhookUrl } = CHANNEL_CONFIG.slack;
  if (!webhookUrl) return;

  const payload = {
    attachments: [
      {
        color: SLACK_COLOR_MAP[alert.severity],
        title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        text: alert.message,
        fields: Object.entries(alert.context || {}).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true,
        })),
        footer: 'CampoTech Alerting',
        ts: Math.floor((alert.timestamp?.getTime() || Date.now()) / 1000),
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[Alerts] Failed to send Slack alert:', error);
  }
}

/**
 * Send alert to Discord
 */
async function sendToDiscord(alert: Alert): Promise<void> {
  const { webhookUrl } = CHANNEL_CONFIG.discord;
  if (!webhookUrl) return;

  const colorMap: Record<AlertSeverity, number> = {
    [AlertSeverity.INFO]: 0x36a64f,
    [AlertSeverity.WARNING]: 0xf2c744,
    [AlertSeverity.ERROR]: 0xe01e5a,
    [AlertSeverity.CRITICAL]: 0x8b0000,
  };

  const payload = {
    embeds: [
      {
        title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        description: alert.message,
        color: colorMap[alert.severity],
        fields: Object.entries(alert.context || {}).map(([key, value]) => ({
          name: key,
          value: String(value),
          inline: true,
        })),
        footer: {
          text: 'CampoTech Alerting',
        },
        timestamp: (alert.timestamp || new Date()).toISOString(),
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[Alerts] Failed to send Discord alert:', error);
  }
}

/**
 * Send alert to PagerDuty
 */
async function sendToPagerDuty(alert: Alert): Promise<void> {
  const { integrationKey } = CHANNEL_CONFIG.pagerduty;
  if (!integrationKey) return;

  // Only send ERROR and CRITICAL to PagerDuty
  if (alert.severity !== AlertSeverity.ERROR && alert.severity !== AlertSeverity.CRITICAL) {
    return;
  }

  const payload = {
    routing_key: integrationKey,
    event_action: 'trigger',
    dedup_key: `${alert.source}-${alert.title}`.replace(/\s+/g, '-').toLowerCase(),
    payload: {
      summary: `[CampoTech] ${alert.title}`,
      severity: PAGERDUTY_SEVERITY_MAP[alert.severity],
      source: alert.source || 'campotech-monitoring',
      custom_details: {
        message: alert.message,
        ...alert.context,
      },
    },
  };

  try {
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[Alerts] Failed to send PagerDuty alert:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

class AlertManager {
  private thresholds: AlertThresholds = DEFAULT_THRESHOLDS;
  private lastAlerts: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 300000; // 5 minutes cooldown for duplicate alerts

  /**
   * Send an alert to configured channels
   */
  async send(alert: Alert): Promise<void> {
    const alertKey = `${alert.title}-${alert.severity}`;
    const now = Date.now();

    // Check cooldown to prevent alert fatigue
    const lastSent = this.lastAlerts.get(alertKey);
    if (lastSent && now - lastSent < this.COOLDOWN_MS) {
      console.log(`[Alerts] Skipping duplicate alert (cooldown): ${alert.title}`);
      return;
    }

    this.lastAlerts.set(alertKey, now);

    // Set timestamp if not provided
    alert.timestamp = alert.timestamp || new Date();

    // Determine channels to use
    const channels = alert.channels || this.getDefaultChannels(alert.severity);

    console.log(`[Alerts] Sending ${alert.severity} alert: ${alert.title} to ${channels.join(', ')}`);

    // Send to all configured channels
    const promises: Promise<void>[] = [];

    for (const channel of channels) {
      switch (channel) {
        case AlertChannel.SENTRY:
          promises.push(sendToSentry(alert));
          break;
        case AlertChannel.SLACK:
          if (CHANNEL_CONFIG.slack.enabled) {
            promises.push(sendToSlack(alert));
          }
          break;
        case AlertChannel.DISCORD:
          if (CHANNEL_CONFIG.discord.enabled) {
            promises.push(sendToDiscord(alert));
          }
          break;
        case AlertChannel.PAGERDUTY:
          if (CHANNEL_CONFIG.pagerduty.enabled) {
            promises.push(sendToPagerDuty(alert));
          }
          break;
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Get default channels based on severity
   */
  private getDefaultChannels(severity: AlertSeverity): AlertChannel[] {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return [AlertChannel.SENTRY, AlertChannel.SLACK, AlertChannel.DISCORD, AlertChannel.PAGERDUTY];
      case AlertSeverity.ERROR:
        return [AlertChannel.SENTRY, AlertChannel.SLACK, AlertChannel.DISCORD];
      case AlertSeverity.WARNING:
        return [AlertChannel.SENTRY, AlertChannel.SLACK];
      case AlertSeverity.INFO:
        return [AlertChannel.SENTRY];
    }
  }

  /**
   * Check error rate and alert if threshold exceeded
   */
  async checkErrorRate(current: number): Promise<void> {
    if (current > this.thresholds.errorRatePercent) {
      await this.send({
        severity: AlertSeverity.ERROR,
        title: 'High Error Rate Detected',
        message: `Error rate has exceeded threshold: ${current.toFixed(2)}% (threshold: ${this.thresholds.errorRatePercent}%)`,
        context: { errorRate: current, threshold: this.thresholds.errorRatePercent },
        source: 'error-rate-monitor',
      });
    }
  }

  /**
   * Check response time and alert if threshold exceeded
   */
  async checkResponseTime(p95Ms: number): Promise<void> {
    if (p95Ms > this.thresholds.responseTimeMs) {
      await this.send({
        severity: AlertSeverity.WARNING,
        title: 'High Response Time Detected',
        message: `P95 response time has exceeded threshold: ${p95Ms}ms (threshold: ${this.thresholds.responseTimeMs}ms)`,
        context: { p95ResponseTime: p95Ms, threshold: this.thresholds.responseTimeMs },
        source: 'response-time-monitor',
      });
    }
  }

  /**
   * Check DLQ depth and alert if threshold exceeded
   */
  async checkDlqDepth(depth: number, queue: string): Promise<void> {
    if (depth > this.thresholds.dlqDepth) {
      await this.send({
        severity: AlertSeverity.ERROR,
        title: 'High DLQ Depth Detected',
        message: `Dead letter queue ${queue} has ${depth} items (threshold: ${this.thresholds.dlqDepth})`,
        context: { queue, depth, threshold: this.thresholds.dlqDepth },
        source: 'dlq-monitor',
      });
    }
  }

  /**
   * Check SLA compliance and alert if below threshold
   */
  async checkSlaCompliance(compliance: number, queue: string): Promise<void> {
    if (compliance < this.thresholds.slaCompliancePercent) {
      await this.send({
        severity: AlertSeverity.WARNING,
        title: 'SLA Compliance Below Threshold',
        message: `Queue ${queue} SLA compliance is ${compliance.toFixed(1)}% (threshold: ${this.thresholds.slaCompliancePercent}%)`,
        context: { queue, compliance, threshold: this.thresholds.slaCompliancePercent },
        source: 'sla-monitor',
      });
    }
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(thresholds: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

export const alertManager = new AlertManager();

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send an info alert
 */
export async function alertInfo(title: string, message: string, context?: Record<string, unknown>): Promise<void> {
  await alertManager.send({ severity: AlertSeverity.INFO, title, message, context });
}

/**
 * Send a warning alert
 */
export async function alertWarning(title: string, message: string, context?: Record<string, unknown>): Promise<void> {
  await alertManager.send({ severity: AlertSeverity.WARNING, title, message, context });
}

/**
 * Send an error alert
 */
export async function alertError(title: string, message: string, context?: Record<string, unknown>): Promise<void> {
  await alertManager.send({ severity: AlertSeverity.ERROR, title, message, context });
}

/**
 * Send a critical alert
 */
export async function alertCritical(title: string, message: string, context?: Record<string, unknown>): Promise<void> {
  await alertManager.send({ severity: AlertSeverity.CRITICAL, title, message, context });
}

export default alertManager;
