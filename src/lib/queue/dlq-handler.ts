/**
 * Dead Letter Queue Handler
 * =========================
 *
 * Handles permanently failed jobs that have exhausted all retry attempts.
 * Provides alerting, manual retry capabilities, and cleanup.
 */

import { Job, Queue } from 'bullmq';
import { JobData, QueueNames, getQueueManager } from './queue-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DLQEntry {
  /** Original queue the job came from */
  sourceQueue: string;
  /** Original job details */
  originalJob: {
    id?: string;
    name: string;
    data: JobData;
    attemptsMade: number;
    failedReason?: string;
    stacktrace?: string[];
  };
  /** When the job was moved to DLQ */
  movedAt: string;
  /** Number of manual retry attempts */
  retryCount?: number;
  /** Last retry attempt time */
  lastRetryAt?: string;
}

export interface DLQStats {
  /** Total jobs in DLQ */
  total: number;
  /** Jobs by source queue */
  byQueue: Record<string, number>;
  /** Jobs by error type */
  byErrorType: Record<string, number>;
  /** Oldest job timestamp */
  oldestJob?: Date;
}

export interface DLQAlertConfig {
  /** Threshold for alerts (number of jobs) */
  threshold: number;
  /** Alert callback */
  onAlert: (stats: DLQStats) => void | Promise<void>;
  /** Check interval in ms */
  checkInterval: number;
  /** Critical queues that trigger immediate alerts */
  criticalQueues?: string[];
  /** Webhook URL for external alerting (Slack, PagerDuty, etc.) */
  webhookUrl?: string;
  /** Enable Sentry integration */
  enableSentry?: boolean;
}

export interface DLQAlert {
  /** Alert type */
  type: 'threshold_exceeded' | 'critical_job_failed' | 'rate_spike';
  /** Alert severity */
  severity: 'warning' | 'error' | 'critical';
  /** Alert message */
  message: string;
  /** DLQ statistics at time of alert */
  stats: DLQStats;
  /** Specific job that triggered alert (if applicable) */
  job?: DLQEntry;
  /** Timestamp */
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DLQ HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class DLQHandler {
  private dlqQueue: Queue;
  private alertConfig?: DLQAlertConfig;
  private alertInterval?: NodeJS.Timeout;
  private lastAlertTime: Map<string, number> = new Map();
  private previousCount = 0;
  private sentryClient?: any;

  // Alert cooldown to prevent spam (5 minutes)
  private readonly ALERT_COOLDOWN_MS = 5 * 60 * 1000;

  constructor() {
    // Queue will be set during initialization
    this.dlqQueue = null as any;
  }

  /**
   * Initialize the DLQ handler
   */
  async initialize(alertConfig?: DLQAlertConfig): Promise<void> {
    const queueManager = getQueueManager();
    this.dlqQueue = queueManager.getQueue(QueueNames.DLQ);

    if (alertConfig) {
      this.alertConfig = alertConfig;
      this.startAlertMonitoring();

      // Initialize Sentry if enabled
      if (alertConfig.enableSentry) {
        await this.initializeSentry();
      }
    }

    console.log('DLQ handler initialized');
  }

  /**
   * Initialize Sentry for error tracking
   */
  private async initializeSentry(): Promise<void> {
    try {
      this.sentryClient = await import('@sentry/node');
      console.log('DLQ Sentry integration enabled');
    } catch {
      console.warn('Sentry not available for DLQ alerting');
    }
  }

  /**
   * Send alert for a job that was moved to DLQ
   */
  async alertOnJobFailure(entry: DLQEntry): Promise<void> {
    if (!this.alertConfig) return;

    // Check if this is a critical queue
    const isCritical = this.alertConfig.criticalQueues?.includes(entry.sourceQueue);

    if (isCritical) {
      const stats = await this.getStats();
      const alert: DLQAlert = {
        type: 'critical_job_failed',
        severity: 'critical',
        message: `Critical job failed in ${entry.sourceQueue}: ${entry.originalJob.failedReason || 'Unknown error'}`,
        stats,
        job: entry,
        timestamp: new Date(),
      };

      await this.sendAlert(alert);
    }
  }

  /**
   * Send an alert through all configured channels
   */
  private async sendAlert(alert: DLQAlert): Promise<void> {
    // Check cooldown
    const alertKey = `${alert.type}:${alert.job?.sourceQueue || 'general'}`;
    const lastAlert = this.lastAlertTime.get(alertKey) || 0;
    if (Date.now() - lastAlert < this.ALERT_COOLDOWN_MS) {
      return; // Skip - still in cooldown
    }
    this.lastAlertTime.set(alertKey, Date.now());

    console.log(`[DLQ ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);

    // Call custom callback
    if (this.alertConfig?.onAlert) {
      try {
        await this.alertConfig.onAlert(alert.stats);
      } catch (error) {
        console.error('Alert callback failed:', error);
      }
    }

    // Send to Sentry
    if (this.sentryClient && this.alertConfig?.enableSentry) {
      await this.sendToSentry(alert);
    }

    // Send to webhook
    if (this.alertConfig?.webhookUrl) {
      await this.sendToWebhook(alert);
    }
  }

  /**
   * Send alert to Sentry
   */
  private async sendToSentry(alert: DLQAlert): Promise<void> {
    if (!this.sentryClient) return;

    try {
      this.sentryClient.withScope((scope: any) => {
        scope.setTag('alert_type', alert.type);
        scope.setTag('severity', alert.severity);
        scope.setLevel(alert.severity === 'critical' ? 'fatal' : alert.severity);

        if (alert.job) {
          scope.setTag('source_queue', alert.job.sourceQueue);
          scope.setTag('org_id', alert.job.originalJob.data.orgId);
          scope.setExtras({
            jobId: alert.job.originalJob.id,
            jobName: alert.job.originalJob.name,
            attemptsMade: alert.job.originalJob.attemptsMade,
            failedReason: alert.job.originalJob.failedReason,
          });
        }

        scope.setExtras({
          dlqTotal: alert.stats.total,
          byQueue: alert.stats.byQueue,
          byErrorType: alert.stats.byErrorType,
        });

        this.sentryClient.captureMessage(alert.message, alert.severity);
      });
    } catch (error) {
      console.error('Failed to send DLQ alert to Sentry:', error);
    }
  }

  /**
   * Send alert to webhook (Slack, PagerDuty, etc.)
   */
  private async sendToWebhook(alert: DLQAlert): Promise<void> {
    if (!this.alertConfig?.webhookUrl) return;

    try {
      const payload = {
        text: `🚨 DLQ Alert: ${alert.message}`,
        attachments: [
          {
            color: alert.severity === 'critical' ? 'danger' : alert.severity === 'error' ? 'warning' : '#439FE0',
            fields: [
              { title: 'Type', value: alert.type, short: true },
              { title: 'Severity', value: alert.severity, short: true },
              { title: 'Total in DLQ', value: String(alert.stats.total), short: true },
              { title: 'Time', value: alert.timestamp.toISOString(), short: true },
            ],
          },
        ],
        // For PagerDuty Events API v2
        routing_key: undefined, // Set if using PagerDuty
        event_action: alert.severity === 'critical' ? 'trigger' : 'acknowledge',
        payload: {
          summary: alert.message,
          severity: alert.severity,
          source: 'campotech-dlq',
          custom_details: {
            stats: alert.stats,
            job: alert.job,
          },
        },
      };

      const response = await fetch(this.alertConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Webhook alert failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send DLQ alert to webhook:', error);
    }
  }

  /**
   * Get DLQ statistics
   */
  async getStats(): Promise<DLQStats> {
    const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed', 'failed']);

    const stats: DLQStats = {
      total: jobs.length,
      byQueue: {},
      byErrorType: {},
    };

    let oldestTimestamp: number | undefined;

    for (const job of jobs) {
      const entry = job.data.payload as DLQEntry;

      // Count by source queue
      const sourceQueue = entry.sourceQueue || 'unknown';
      stats.byQueue[sourceQueue] = (stats.byQueue[sourceQueue] || 0) + 1;

      // Count by error type
      const errorType = this.classifyError(entry.originalJob.failedReason);
      stats.byErrorType[errorType] = (stats.byErrorType[errorType] || 0) + 1;

      // Track oldest job
      const timestamp = job.timestamp;
      if (!oldestTimestamp || timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
      }
    }

    if (oldestTimestamp) {
      stats.oldestJob = new Date(oldestTimestamp);
    }

    return stats;
  }

  /**
   * Get DLQ entries with pagination
   */
  async getEntries(
    options: {
      offset?: number;
      limit?: number;
      sourceQueue?: string;
    } = {}
  ): Promise<{ entries: DLQEntry[]; total: number }> {
    const { offset = 0, limit = 50, sourceQueue } = options;

    let jobs = await this.dlqQueue.getJobs(['waiting', 'delayed', 'failed']);

    // Filter by source queue if specified
    if (sourceQueue) {
      jobs = jobs.filter((job) => {
        const entry = job.data.payload as DLQEntry;
        return entry.sourceQueue === sourceQueue;
      });
    }

    const total = jobs.length;

    // Apply pagination
    const paginatedJobs = jobs.slice(offset, offset + limit);

    const entries = paginatedJobs.map((job) => job.data.payload as DLQEntry);

    return { entries, total };
  }

  /**
   * Retry a specific DLQ job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.dlqQueue.getJob(jobId);

    if (!job) {
      throw new Error(`DLQ job not found: ${jobId}`);
    }

    const entry = job.data.payload as DLQEntry;
    const queueManager = getQueueManager();

    try {
      // Get the original queue
      const sourceQueue = queueManager.getQueue(entry.sourceQueue);

      // Re-add job to original queue
      await sourceQueue.add(entry.originalJob.name, entry.originalJob.data, {
        attempts: 3, // Give it 3 more attempts
        backoff: {
          type: 'exponential',
          delay: 10000, // Start with 10 second delay
        },
      });

      // Update DLQ entry
      await job.updateData({
        ...job.data,
        payload: {
          ...entry,
          retryCount: (entry.retryCount || 0) + 1,
          lastRetryAt: new Date().toISOString(),
        },
      });

      // Remove from DLQ
      await job.remove();

      console.log(`Retried DLQ job ${jobId} to ${entry.sourceQueue}`);
      return true;
    } catch (error) {
      console.error(`Failed to retry DLQ job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Retry all jobs from a specific source queue
   */
  async retryAllFromQueue(sourceQueue: string): Promise<{ retried: number; failed: number }> {
    const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed', 'failed']);
    const results = { retried: 0, failed: 0 };

    for (const job of jobs) {
      const entry = job.data.payload as DLQEntry;

      if (entry.sourceQueue !== sourceQueue) {
        continue;
      }

      try {
        await this.retryJob(job.id!);
        results.retried++;
      } catch {
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Delete a DLQ job
   */
  async deleteJob(jobId: string): Promise<void> {
    const job = await this.dlqQueue.getJob(jobId);

    if (!job) {
      throw new Error(`DLQ job not found: ${jobId}`);
    }

    await job.remove();
    console.log(`Deleted DLQ job ${jobId}`);
  }

  /**
   * Delete all DLQ jobs older than specified age
   */
  async purgeOldJobs(maxAgeMs: number): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed', 'failed']);

    let deleted = 0;

    for (const job of jobs) {
      if (job.timestamp < cutoff) {
        await job.remove();
        deleted++;
      }
    }

    console.log(`Purged ${deleted} old DLQ jobs`);
    return deleted;
  }

  /**
   * Export DLQ jobs for analysis
   */
  async exportJobs(sourceQueue?: string): Promise<DLQEntry[]> {
    const { entries } = await this.getEntries({
      limit: 10000,
      sourceQueue,
    });

    return entries;
  }

  /**
   * Classify error type for statistics
   */
  private classifyError(errorMessage?: string): string {
    if (!errorMessage) {
      return 'unknown';
    }

    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('timeout')) {
      return 'timeout';
    }
    if (lowerMessage.includes('rate limit')) {
      return 'rate_limit';
    }
    if (lowerMessage.includes('connection') || lowerMessage.includes('network')) {
      return 'network';
    }
    if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized')) {
      return 'auth';
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return 'validation';
    }
    if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
      return 'not_found';
    }
    if (lowerMessage.includes('500') || lowerMessage.includes('internal')) {
      return 'server_error';
    }

    return 'other';
  }

  /**
   * Start alert monitoring
   */
  private startAlertMonitoring(): void {
    if (!this.alertConfig) {
      return;
    }

    this.alertInterval = setInterval(async () => {
      try {
        const stats = await this.getStats();

        // Check threshold exceeded
        if (stats.total >= this.alertConfig!.threshold) {
          const alert: DLQAlert = {
            type: 'threshold_exceeded',
            severity: stats.total >= this.alertConfig!.threshold * 2 ? 'critical' : 'warning',
            message: `DLQ threshold exceeded: ${stats.total} jobs (threshold: ${this.alertConfig!.threshold})`,
            stats,
            timestamp: new Date(),
          };
          await this.sendAlert(alert);
        }

        // Check for rate spike (>50% increase since last check)
        if (this.previousCount > 0 && stats.total > this.previousCount * 1.5) {
          const alert: DLQAlert = {
            type: 'rate_spike',
            severity: 'error',
            message: `DLQ rate spike detected: ${this.previousCount} → ${stats.total} jobs (+${Math.round((stats.total / this.previousCount - 1) * 100)}%)`,
            stats,
            timestamp: new Date(),
          };
          await this.sendAlert(alert);
        }

        this.previousCount = stats.total;
      } catch (error) {
        console.error('DLQ alert check failed:', error);
      }
    }, this.alertConfig.checkInterval);
  }

  /**
   * Stop alert monitoring
   */
  stopAlertMonitoring(): void {
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = undefined;
    }
  }

  /**
   * Shutdown the handler
   */
  async shutdown(): Promise<void> {
    this.stopAlertMonitoring();
    console.log('DLQ handler shutdown');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let dlqHandler: DLQHandler | null = null;

/**
 * Initialize the global DLQ handler
 */
export async function initializeDLQHandler(alertConfig?: DLQAlertConfig): Promise<void> {
  dlqHandler = new DLQHandler();
  await dlqHandler.initialize(alertConfig);
}

/**
 * Get the global DLQ handler
 */
export function getDLQHandler(): DLQHandler {
  if (!dlqHandler) {
    throw new Error('DLQ handler not initialized. Call initializeDLQHandler first.');
  }
  return dlqHandler;
}
